#!/usr/bin/env python3
"""Run smoke tests against a running meet37 deployment."""

from __future__ import annotations

import argparse
import json
import socket
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = ROOT / ".env"
DEFAULT_COMPOSE_FILE = ROOT / "docker-compose.prod.yml"


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def run(command: list[str], *, check: bool = False) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(command), flush=True)
    return subprocess.run(command, check=check, capture_output=True, text=True)


def compose_cmd() -> list[str]:
    result = run(["docker", "compose", "version"])
    if result.returncode == 0:
        return ["docker", "compose"]
    return ["docker-compose"]


def request(url: str, timeout: float) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "meet37-smoke-test"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        body = response.read(4096).decode("utf-8", errors="replace")
        return response.status, body


def http_check(name: str, url: str, timeout: float, expected: set[int]) -> bool:
    try:
        status, body = request(url, timeout)
    except urllib.error.HTTPError as exc:
        status = exc.code
        body = exc.read(4096).decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"FAIL {name}: {exc}")
        return False

    if status not in expected:
        print(f"FAIL {name}: status {status}, body={body[:200]!r}")
        return False
    print(f"PASS {name}: {status}")
    return True


def websocket_check(base_url: str, timeout: float) -> bool:
    parsed = urllib.parse.urlparse(base_url)
    secure = parsed.scheme == "https"
    host = parsed.hostname
    if not host:
        print("FAIL websocket: base URL has no host")
        return False
    port = parsed.port or (443 if secure else 80)
    path = "/ws"
    key = "dGhlIHNhbXBsZSBub25jZQ=="
    request_text = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "\r\n"
    )
    try:
        raw = socket.create_connection((host, port), timeout=timeout)
        with raw:
            sock = ssl.create_default_context().wrap_socket(raw, server_hostname=host) if secure else raw
            with sock:
                sock.settimeout(timeout)
                sock.sendall(request_text.encode("ascii"))
                response = sock.recv(512).decode("iso-8859-1", errors="replace")
    except Exception as exc:
        print(f"FAIL websocket: {exc}")
        return False

    if " 101 " not in response.splitlines()[0]:
        print(f"FAIL websocket: {response.splitlines()[0] if response else 'no response'}")
        return False
    print("PASS websocket: 101 Switching Protocols")
    return True


def compose_check(compose_file: Path) -> bool:
    try:
        result = run([*compose_cmd(), "-f", str(compose_file), "ps"], check=False)
    except FileNotFoundError as exc:
        print(f"FAIL compose: {exc}")
        return False
    if result.returncode != 0:
        print(f"FAIL compose: {result.stderr.strip()}")
        return False
    print("PASS compose ps")
    return True


def default_base_url(values: dict[str, str]) -> str:
    if values.get("PUBLIC_ORIGIN"):
        return values["PUBLIC_ORIGIN"].rstrip("/")
    port = values.get("FRONTEND_HOST_PORT") or values.get("FRONTEND_PORT") or "3000"
    return f"http://127.0.0.1:{port}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke test meet37.")
    parser.add_argument("--env-file", default=str(DEFAULT_ENV_FILE))
    parser.add_argument("--compose-file", default=str(DEFAULT_COMPOSE_FILE))
    parser.add_argument("--base-url", default="")
    parser.add_argument("--timeout", type=float, default=8.0)
    parser.add_argument("--skip-compose", action="store_true")
    parser.add_argument("--skip-websocket", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    values = parse_env_file(Path(args.env_file))
    base_url = (args.base_url or default_base_url(values)).rstrip("/")
    checks = [
        http_check("frontend", base_url + "/", args.timeout, {200, 307, 308}),
        http_check("settings", base_url + "/api/settings", args.timeout, {200}),
    ]

    try:
        status, body = request(base_url + "/api/settings", args.timeout)
        if status == 200:
            json.loads(body)
    except Exception as exc:
        print(f"FAIL settings json: {exc}")
        checks.append(False)
    else:
        print("PASS settings json")
        checks.append(True)

    if not args.skip_websocket:
        checks.append(websocket_check(base_url, args.timeout))
    if not args.skip_compose:
        checks.append(compose_check(Path(args.compose_file)))

    if all(checks):
        print("Smoke test passed.")
        return 0
    print("Smoke test failed.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
