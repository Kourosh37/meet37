#!/usr/bin/env python3
"""Check and fix meet37 server requirements."""

from __future__ import annotations

import argparse
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = ROOT / ".env"
DEFAULT_ENV_EXAMPLE = ROOT / ".env.example"
DEFAULT_COMPOSE_FILE = ROOT / "docker-compose.yml"


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(command), flush=True)
    return subprocess.run(command, check=check, text=True, capture_output=True)


def command_exists(command: str) -> bool:
    return shutil.which(command) is not None


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


def write_env_file(path: Path, values: dict[str, str]) -> None:
    existing_lines = (
        path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    )
    written: set[str] = set()
    output: list[str] = []

    for raw_line in existing_lines:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            output.append(raw_line)
            continue

        key = stripped.split("=", 1)[0].strip()
        if key in values:
            output.append(f"{key}={values[key]}")
            written.add(key)
        else:
            output.append(raw_line)

    for key in sorted(set(values) - written):
        output.append(f"{key}={values[key]}")

    path.write_text("\n".join(output).rstrip() + "\n", encoding="utf-8")


def ensure_env_file(env_file: Path, example_file: Path) -> None:
    if env_file.exists():
        return

    if example_file.exists():
        shutil.copyfile(example_file, env_file)
        print(f"created {env_file} from {example_file}")
        return

    env_file.write_text("", encoding="utf-8")
    print(f"created empty {env_file}")


def is_port_available(port: int, host: str = "0.0.0.0", udp: bool = False) -> bool:
    family = socket.AF_INET
    sock_type = socket.SOCK_DGRAM if udp else socket.SOCK_STREAM
    with socket.socket(family, sock_type) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def docker_port_is_owned(
    port: int, proto: str, allowed_container_names: set[str]
) -> bool:
    if not allowed_container_names or not command_exists("docker"):
        return False

    result = run(
        ["docker", "ps", "--format", "{{.Names}}\t{{.Ports}}"],
        check=False,
    )
    if result.returncode != 0:
        return False

    for line in result.stdout.splitlines():
        name, _, ports = line.partition("\t")
        if not any(allowed in name for allowed in allowed_container_names):
            continue
        for match in re.finditer(
            rf"(?:0\.0\.0\.0|\[::\]|127\.0\.0\.1)?[:]?"
            rf"(?P<start>\d+)(?:-(?P<end>\d+))?->.*?/{proto}",
            ports,
        ):
            start = int(match.group("start"))
            end = int(match.group("end") or start)
            if start <= port <= end:
                return True
    return False


def port_is_usable(
    port: int,
    *,
    allowed_container_names: set[str],
    udp: bool = False,
) -> bool:
    if is_port_available(port, udp=udp):
        return True
    proto = "udp" if udp else "tcp"
    return docker_port_is_owned(port, proto, allowed_container_names)


def find_available_port(
    preferred: int,
    *,
    allowed_container_names: set[str],
    udp: bool = False,
) -> int:
    for port in range(preferred, preferred + 1000):
        if port_is_usable(port, allowed_container_names=allowed_container_names, udp=udp):
            return port
    raise RuntimeError(f"could not find a free {'UDP' if udp else 'TCP'} port")


def range_is_available(
    start: int, end: int, *, allowed_container_names: set[str]
) -> bool:
    return all(
        port_is_usable(port, allowed_container_names=allowed_container_names, udp=True)
        for port in range(start, end + 1)
    )


def find_available_udp_range(
    start: int, end: int, *, allowed_container_names: set[str]
) -> tuple[int, int]:
    size = end - start + 1
    candidate = start
    while candidate + size - 1 <= 65535:
        candidate_end = candidate + size - 1
        if range_is_available(
            candidate, candidate_end, allowed_container_names=allowed_container_names
        ):
            return candidate, candidate_end
        candidate += size
    raise RuntimeError("could not find a free UDP media port range")


def capture_public_ip(values: dict[str, str]) -> str:
    urls = [
        url.strip()
        for url in values.get("PUBLIC_IP_DISCOVERY_URLS", "").split(",")
        if url.strip()
    ]
    for url in urls:
        if not command_exists("curl"):
            break
        result = run(["curl", "-4", "-fsS", "--max-time", "4", url], check=False)
        value = result.stdout.strip()
        if result.returncode == 0 and value and "." in value:
            return value
    return ""


def generated_secret() -> str:
    return secrets.token_urlsafe(48)


def ensure_required_env(
    values: dict[str, str], defaults: dict[str, str], args: argparse.Namespace
) -> None:
    for key in [
        "PORT",
        "BACKEND_HOST_PORT",
        "BACKEND_HEALTHCHECK_URL",
        "FRONTEND_PORT",
        "FRONTEND_HOST_PORT",
        "FRONTEND_HEALTHCHECK_URL",
        "TURN_PORT",
        "TURN_HOST_PORT",
        "WEBRTC_UDP_PORT_MIN",
        "WEBRTC_UDP_PORT_MAX",
        "WEBRTC_UDP_HOST_PORT_MIN",
        "WEBRTC_UDP_HOST_PORT_MAX",
        "NEXT_PUBLIC_API_BASE_URL",
        "NEXT_PUBLIC_WS_URL",
        "NEXT_PUBLIC_TURN_PUBLIC_IP",
        "BACKEND_INTERNAL_URL",
        "PUBLIC_IP_DISCOVERY_URLS",
        "DB_PATH",
        "ENV",
    ]:
        if not values.get(key) and defaults.get(key):
            values[key] = defaults[key]

    public_ip = args.public_ip or capture_public_ip(values)

    if public_ip:
        if not values.get("TURN_PUBLIC_IP") or values["TURN_PUBLIC_IP"] in {
            "127.0.0.1",
            "localhost",
        }:
            values["TURN_PUBLIC_IP"] = public_ip
        if not values.get("NEXT_PUBLIC_TURN_PUBLIC_IP") or values[
            "NEXT_PUBLIC_TURN_PUBLIC_IP"
        ] in {"127.0.0.1", "localhost"}:
            values["NEXT_PUBLIC_TURN_PUBLIC_IP"] = values["TURN_PUBLIC_IP"]

    if args.public_origin:
        values["ALLOWED_ORIGINS"] = args.public_origin
        values.setdefault("PUBLIC_ORIGIN", args.public_origin)
        if args.public_origin.startswith("https://"):
            domain = args.public_origin.removeprefix("https://").split("/", 1)[0]
            values.setdefault("PUBLIC_DOMAIN", domain)

    if not values.get("JWT_SECRET") or values["JWT_SECRET"].startswith("replace_"):
        values["JWT_SECRET"] = generated_secret()

    if not values.get("TURN_SECRET") or values["TURN_SECRET"] in {
        "turnsecret",
        "another_random_secret_for_turn",
    }:
        values["TURN_SECRET"] = generated_secret()


def fix_ports(values: dict[str, str], allowed_container_names: set[str]) -> list[str]:
    changes: list[str] = []

    frontend = int(values["FRONTEND_HOST_PORT"])
    next_frontend = find_available_port(
        frontend, allowed_container_names=allowed_container_names
    )
    if next_frontend != frontend:
        values["FRONTEND_HOST_PORT"] = str(next_frontend)
        changes.append(f"FRONTEND_HOST_PORT {frontend} -> {next_frontend}")

    backend = int(values["BACKEND_HOST_PORT"])
    next_backend = find_available_port(
        backend, allowed_container_names=allowed_container_names
    )
    if next_backend != backend:
        values["BACKEND_HOST_PORT"] = str(next_backend)
        changes.append(f"BACKEND_HOST_PORT {backend} -> {next_backend}")

    turn = int(values["TURN_HOST_PORT"])
    next_turn = turn
    while not (
        port_is_usable(next_turn, allowed_container_names=allowed_container_names, udp=True)
        and port_is_usable(
            next_turn, allowed_container_names=allowed_container_names, udp=False
        )
    ):
        next_turn += 1
    if next_turn != turn:
        values["TURN_HOST_PORT"] = str(next_turn)
        values["TURN_PORT"] = str(next_turn)
        changes.append(f"TURN_PORT/TURN_HOST_PORT {turn} -> {next_turn}")

    udp_min = int(values["WEBRTC_UDP_HOST_PORT_MIN"])
    udp_max = int(values["WEBRTC_UDP_HOST_PORT_MAX"])
    if not range_is_available(
        udp_min, udp_max, allowed_container_names=allowed_container_names
    ):
        next_min, next_max = find_available_udp_range(
            udp_min, udp_max, allowed_container_names=allowed_container_names
        )
        values["WEBRTC_UDP_PORT_MIN"] = str(next_min)
        values["WEBRTC_UDP_PORT_MAX"] = str(next_max)
        values["WEBRTC_UDP_HOST_PORT_MIN"] = str(next_min)
        values["WEBRTC_UDP_HOST_PORT_MAX"] = str(next_max)
        changes.append(f"WEBRTC UDP range {udp_min}-{udp_max} -> {next_min}-{next_max}")

    return changes


def docker_compose_command() -> list[str]:
    if not command_exists("docker"):
        raise RuntimeError("docker is not installed")
    result = run(["docker", "compose", "version"], check=False)
    if result.returncode == 0:
        return ["docker", "compose"]
    if command_exists("docker-compose"):
        return ["docker-compose"]
    raise RuntimeError("docker compose is not available")


def ensure_docker() -> None:
    if not command_exists("docker"):
        raise RuntimeError("docker is not installed")
    result = run(["docker", "info"], check=False)
    if result.returncode != 0:
        raise RuntimeError("docker is installed but not running or not accessible")


def ensure_docker_network(name: str) -> None:
    if not name:
        return
    result = run(["docker", "network", "inspect", name], check=False)
    if result.returncode == 0:
        print(f"docker network {name} exists")
        return
    run(["docker", "network", "create", name])


def ufw_is_active() -> bool:
    if not command_exists("ufw"):
        return False
    result = run(["ufw", "status"], check=False)
    return "Status: active" in result.stdout


def ufw_allow(rule: str) -> None:
    if os.name != "posix" or not command_exists("ufw") or not ufw_is_active():
        return
    run(["ufw", "allow", rule], check=False)


def fix_firewall(values: dict[str, str], include_frontend: bool) -> None:
    if not ufw_is_active():
        print("ufw is not active; firewall rules were not changed")
        return

    ufw_allow("80/tcp")
    ufw_allow("443/tcp")
    if include_frontend:
        ufw_allow(f"{values['FRONTEND_HOST_PORT']}/tcp")
    ufw_allow(f"{values['TURN_HOST_PORT']}/tcp")
    ufw_allow(f"{values['TURN_HOST_PORT']}/udp")
    ufw_allow(
        f"{values['WEBRTC_UDP_HOST_PORT_MIN']}:{values['WEBRTC_UDP_HOST_PORT_MAX']}/udp"
    )
    run(["ufw", "reload"], check=False)


def validate_compose(compose_file: Path) -> None:
    compose = docker_compose_command()
    run([*compose, "-f", str(compose_file), "config", "-q"])


def allowed_container_names(compose_file: Path) -> set[str]:
    project = compose_file.parent.name
    return {project, "meet37"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check and fix meet37 Docker/server requirements."
    )
    parser.add_argument("--env-file", default=str(DEFAULT_ENV_FILE))
    parser.add_argument("--env-example", default=str(DEFAULT_ENV_EXAMPLE))
    parser.add_argument("--compose-file", default=str(DEFAULT_COMPOSE_FILE))
    parser.add_argument("--public-ip", default="")
    parser.add_argument("--public-origin", default="")
    parser.add_argument("--proxy-network", default="")
    parser.add_argument("--include-frontend-port", action="store_true")
    parser.add_argument("--restart", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env_file = Path(args.env_file).resolve()
    env_example = Path(args.env_example).resolve()
    compose_file = Path(args.compose_file).resolve()

    try:
        ensure_env_file(env_file, env_example)
        values = parse_env_file(env_file)
        defaults = parse_env_file(env_example)
        ensure_required_env(values, defaults, args)
        ensure_docker()
        port_changes = fix_ports(values, allowed_container_names(compose_file))
        write_env_file(env_file, values)
        if args.proxy_network:
            ensure_docker_network(args.proxy_network)
        fix_firewall(values, args.include_frontend_port)
        validate_compose(compose_file)

        if args.restart:
            compose = docker_compose_command()
            run([*compose, "-f", str(compose_file), "up", "-d"])

    except (RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"failed: {exc}", file=sys.stderr)
        return 1

    print("\nmeet37 server requirements are ready.")
    if port_changes:
        print("Port fixes:")
        for change in port_changes:
            print(f"  {change}")
    print(f"Env file: {env_file}")
    print(f"Compose file: {compose_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
