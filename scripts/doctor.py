#!/usr/bin/env python3
"""Diagnose meet37 local or production runtime requirements."""

from __future__ import annotations

import argparse
import shutil
import socket
import subprocess
import sys
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


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(command), flush=True)
    return subprocess.run(command, cwd=ROOT, capture_output=True, text=True)


def check(name: str, ok: bool, detail: str = "") -> bool:
    status = "PASS" if ok else "FAIL"
    suffix = f": {detail}" if detail else ""
    print(f"{status} {name}{suffix}")
    return ok


def command_check(command: str) -> bool:
    return check(f"command {command}", shutil.which(command) is not None)


def docker_check() -> bool:
    result = run(["docker", "info"])
    return check("docker daemon", result.returncode == 0, result.stderr.strip())


def compose_check(compose_file: Path) -> bool:
    result = run(["docker", "compose", "-f", str(compose_file), "config", "-q"])
    return check("compose config", result.returncode == 0, result.stderr.strip())


def port_check(name: str, port: int, udp: bool = False) -> bool:
    sock_type = socket.SOCK_DGRAM if udp else socket.SOCK_STREAM
    with socket.socket(socket.AF_INET, sock_type) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("0.0.0.0", port))
        except OSError:
            return check(name, True, f"port {port} is already bound, likely by service")
    return check(name, True, f"port {port} is available")


def port_range_check(name: str, start: int, end: int) -> bool:
    sample = sorted({start, end, start + max(0, (end - start) // 2)})
    results = [port_check(f"{name} {port}/udp", port, True) for port in sample]
    return all(results)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Diagnose meet37 requirements.")
    parser.add_argument("--env-file", default=str(DEFAULT_ENV_FILE))
    parser.add_argument("--compose-file", default=str(DEFAULT_COMPOSE_FILE))
    parser.add_argument("--base-url", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env_file = Path(args.env_file)
    compose_file = Path(args.compose_file)
    values = parse_env_file(env_file)

    results = [
        check("env file exists", env_file.exists(), str(env_file)),
        check("compose file exists", compose_file.exists(), str(compose_file)),
        command_check("python"),
        command_check("docker"),
        docker_check(),
    ]

    validate = run(["python", "scripts/validate_env.py", "--env-file", str(env_file)])
    results.append(check("env validation", validate.returncode == 0, validate.stdout.strip()))
    results.append(compose_check(compose_file))

    for key, proto in [
        ("TURN_HOST_PORT", "tcp"),
        ("TURN_HOST_PORT", "udp"),
        ("FRONTEND_HOST_PORT", "tcp"),
        ("BACKEND_HOST_PORT", "tcp"),
    ]:
        if values.get(key, "").isdigit():
            results.append(port_check(f"{key}/{proto}", int(values[key]), proto == "udp"))

    for prefix in ["TURN_RELAY_PORT", "WEBRTC_UDP_HOST_PORT"]:
        min_key = f"{prefix}_MIN"
        max_key = f"{prefix}_MAX"
        if values.get(min_key, "").isdigit() and values.get(max_key, "").isdigit():
            results.append(
                port_range_check(prefix, int(values[min_key]), int(values[max_key]))
            )

    if args.base_url:
        result = run(["python", "scripts/smoke_test.py", "--base-url", args.base_url])
        results.append(check("smoke test", result.returncode == 0))

    result = run(["docker", "ps", "--format", "{{.Names}}\t{{.Status}}\t{{.Ports}}"])
    if result.returncode == 0 and result.stdout.strip():
        print("\nRunning containers:")
        print(result.stdout.strip())

    if all(results):
        print("\nDoctor completed successfully.")
        return 0
    print("\nDoctor found issues.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
