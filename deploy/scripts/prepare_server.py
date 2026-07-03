#!/usr/bin/env python3
"""Prepare a Linux server for running meet37 with Docker Compose."""

from __future__ import annotations

import argparse
import os
import platform
import secrets
import shutil
import socket
import subprocess
import sys
from pathlib import Path


def find_project_root() -> Path:
    script_dir = Path(__file__).resolve().parent
    for candidate in [script_dir.parent, script_dir]:
        if (candidate / "docker-compose.yml").exists() or (
            candidate / "docker-compose.prod.yml"
        ).exists():
            return candidate
    return script_dir.parent


ROOT = find_project_root()
DEFAULT_ENV_FILE = ROOT / ".env"
DEFAULT_ENV_EXAMPLE = ROOT / ".env.example"
DEFAULT_COMPOSE_FILE = ROOT / "docker-compose.prod.yml"

DEFAULTS = {
    "PORT": "8080",
    "BACKEND_HOST_PORT": "8080",
    "BACKEND_HEALTHCHECK_URL": "http://localhost:8080/health",
    "ENV": "production",
    "ADMIN_USERNAME": "admin",
    "ADMIN_PASSWORD": "",
    "JWT_SECRET": "",
    "DEFAULT_APP_MODE": "public",
    "TURN_PUBLIC_IP": "127.0.0.1",
    "PUBLIC_IP_DISCOVERY_URLS": "https://ifconfig.me,https://icanhazip.com,https://api.ipify.org",
    "TURN_PORT": "3478",
    "TURN_HOST_PORT": "3478",
    "TURN_RELAY_PORT_MIN": "43000",
    "TURN_RELAY_PORT_MAX": "43500",
    "TURN_REALM": "localhost",
    "TURN_SECRET": "",
    "DB_PATH": "/data/meet.db",
    "ALLOWED_ORIGINS": "http://localhost:3000,http://127.0.0.1:3000",
    "ACCESS_TOKEN_TTL_MINUTES": "15",
    "REFRESH_TOKEN_TTL_DAYS": "30",
    "RATE_LIMIT_RPS": "20",
    "RATE_LIMIT_BURST": "60",
    "MAX_BODY_BYTES": "1048576",
    "SFU_RECORDING_ENABLED": "false",
    "SFU_RECORDING_PATH": "/data/recordings",
    "WEBRTC_UDP_PORT_MIN": "40000",
    "WEBRTC_UDP_PORT_MAX": "40500",
    "WEBRTC_UDP_HOST_PORT_MIN": "40000",
    "WEBRTC_UDP_HOST_PORT_MAX": "40500",
    "REDIS_URL": "",
    "INSTANCE_ID": "",
    "NEXT_PUBLIC_API_BASE_URL": "browser-origin",
    "FRONTEND_HOST_PORT": "3000",
    "FRONTEND_PORT": "3000",
    "FRONTEND_HEALTHCHECK_URL": "http://127.0.0.1:3000/",
    "NEXT_PUBLIC_WS_URL": "browser-origin",
    "NEXT_PUBLIC_TURN_PUBLIC_IP": "127.0.0.1",
    "BACKEND_INTERNAL_URL": "http://backend:8080",
    "DOCKER_BACKEND_IMAGE": "meet37-backend",
    "DOCKER_FRONTEND_IMAGE": "meet37-frontend",
    "DOCKER_IMAGE_OUTPUT_DIR": "dist",
    "DOCKER_IMAGE_TAG": "latest",
    "BACKEND_CONTAINER_NAME": "meet37-backend",
    "FRONTEND_CONTAINER_NAME": "meet37",
    "COTURN_CONTAINER_NAME": "meet37-coturn",
    "CADDY_CONTAINER_NAME": "meet37-caddy",
    "COTURN_IMAGE": "coturn/coturn:latest",
    "CADDY_IMAGE": "caddy:2-alpine",
    "DOCKER_EXTRA_IMAGES": "",
    "DOCKER_INTERNAL_NETWORK": "meet37_internal",
    "PUBLIC_DOMAIN": "localhost",
    "CADDY_TLS_CERT": "/etc/caddy/certs/fullchain.pem",
    "CADDY_TLS_KEY": "/etc/caddy/certs/privkey.pem",
}


def run(
    command: list[str],
    *,
    check: bool = True,
    capture: bool = False,
) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(command), flush=True)
    return subprocess.run(
        command,
        cwd=ROOT,
        check=check,
        text=True,
        capture_output=capture,
    )


def command_exists(command: str) -> bool:
    return shutil.which(command) is not None


def sudo_prefix() -> list[str]:
    if os.name != "posix" or os.geteuid() == 0:
        return []
    if command_exists("sudo"):
        return ["sudo"]
    raise RuntimeError("run as root or install sudo")


def run_root(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run([*sudo_prefix(), *command], check=check)


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
    existing = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    written: set[str] = set()
    lines: list[str] = []

    for raw_line in existing:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            lines.append(raw_line)
            continue
        key = stripped.split("=", 1)[0].strip()
        if key in values:
            lines.append(f"{key}={values[key]}")
            written.add(key)
        else:
            lines.append(raw_line)

    for key in sorted(set(values) - written):
        lines.append(f"{key}={values[key]}")

    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def generated_secret() -> str:
    return secrets.token_urlsafe(48)


def ensure_env_file(env_file: Path, example_file: Path) -> None:
    if env_file.exists():
        return
    if example_file.exists():
        shutil.copyfile(example_file, env_file)
    else:
        env_file.write_text("", encoding="utf-8")
    print(f"created {env_file}")


def discover_public_ip(values: dict[str, str]) -> str:
    if not command_exists("curl"):
        return ""
    urls = [
        item.strip()
        for item in values.get("PUBLIC_IP_DISCOVERY_URLS", "").split(",")
        if item.strip()
    ]
    for url in urls:
        result = run(
            ["curl", "-4", "-fsS", "--max-time", "5", url],
            check=False,
            capture=True,
        )
        value = result.stdout.strip()
        if result.returncode == 0 and value.count(".") == 3:
            return value
    return ""


def normalize_env(values: dict[str, str], args: argparse.Namespace) -> dict[str, str]:
    next_values = {**DEFAULTS, **values}
    public_ip = args.public_ip or discover_public_ip(next_values)
    if public_ip:
        if next_values.get("TURN_PUBLIC_IP") in {"", "127.0.0.1", "localhost"}:
            next_values["TURN_PUBLIC_IP"] = public_ip
        if next_values.get("NEXT_PUBLIC_TURN_PUBLIC_IP") in {
            "",
            "127.0.0.1",
            "localhost",
        }:
            next_values["NEXT_PUBLIC_TURN_PUBLIC_IP"] = next_values["TURN_PUBLIC_IP"]

    if args.public_origin:
        next_values["ALLOWED_ORIGINS"] = args.public_origin
        next_values["PUBLIC_ORIGIN"] = args.public_origin
        if args.public_origin.startswith("https://"):
            host = args.public_origin.removeprefix("https://").split("/", 1)[0]
            next_values["PUBLIC_DOMAIN"] = host
            if next_values.get("TURN_REALM") in {"", "localhost"}:
                next_values["TURN_REALM"] = host

    insecure = {
        "ADMIN_PASSWORD": {"", "change_me_strong_password", "changeme", "password"},
        "JWT_SECRET": {"", "replace_with_a_long_random_secret", "change-me-in-production"},
        "TURN_SECRET": {"", "another_random_secret_for_turn", "turnsecret"},
    }
    for key, bad_values in insecure.items():
        if next_values.get(key, "") in bad_values:
            next_values[key] = generated_secret()

    if not next_values.get("DOCKER_IMAGE_TAG"):
        next_values["DOCKER_IMAGE_TAG"] = "latest"

    return next_values


def install_docker_if_needed(args: argparse.Namespace) -> None:
    if command_exists("docker"):
        return
    if not args.install_docker:
        raise RuntimeError("Docker is not installed. Re-run with --install-docker.")
    if os.name != "posix":
        raise RuntimeError("automatic Docker installation is only supported on Linux")

    distro = platform.freedesktop_os_release().get("ID", "").lower()
    if distro in {"ubuntu", "debian"}:
        run_root(["apt-get", "update"])
        run_root(["apt-get", "install", "-y", "ca-certificates", "curl", "gnupg"])
        run_root(["install", "-m", "0755", "-d", "/etc/apt/keyrings"])
        run_root(
            [
                "sh",
                "-c",
                "curl -fsSL https://download.docker.com/linux/%s/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg"
                % distro,
            ]
        )
        codename = platform.freedesktop_os_release().get("VERSION_CODENAME", "")
        arch = subprocess.check_output(["dpkg", "--print-architecture"], text=True).strip()
        repo = (
            f"deb [arch={arch} signed-by=/etc/apt/keyrings/docker.gpg] "
            f"https://download.docker.com/linux/{distro} {codename} stable"
        )
        run_root(["sh", "-c", f"echo '{repo}' > /etc/apt/sources.list.d/docker.list"])
        run_root(["apt-get", "update"])
        run_root(
            [
                "apt-get",
                "install",
                "-y",
                "docker-ce",
                "docker-ce-cli",
                "containerd.io",
                "docker-buildx-plugin",
                "docker-compose-plugin",
            ]
        )
        return

    if distro in {"centos", "rhel", "rocky", "almalinux", "fedora"}:
        package_manager = "dnf" if command_exists("dnf") else "yum"
        run_root([package_manager, "install", "-y", "yum-utils"])
        run_root(
            [
                "yum-config-manager",
                "--add-repo",
                "https://download.docker.com/linux/centos/docker-ce.repo",
            ]
        )
        run_root(
            [
                package_manager,
                "install",
                "-y",
                "docker-ce",
                "docker-ce-cli",
                "containerd.io",
                "docker-buildx-plugin",
                "docker-compose-plugin",
            ]
        )
        return

    raise RuntimeError(f"unsupported distro for automatic Docker install: {distro}")


def ensure_docker_running() -> None:
    if not command_exists("docker"):
        raise RuntimeError("Docker is not installed")
    run_root(["systemctl", "enable", "--now", "docker"], check=False)
    result = run(["docker", "info"], check=False, capture=True)
    if result.returncode != 0:
        raise RuntimeError("Docker is installed but not accessible")


def ensure_docker_access(args: argparse.Namespace) -> None:
    user = args.docker_user or os.environ.get("SUDO_USER") or ""
    if not user or os.name != "posix":
        return
    if not command_exists("getent"):
        return
    group_exists = run(["getent", "group", "docker"], check=False, capture=True)
    if group_exists.returncode != 0:
        run_root(["groupadd", "docker"], check=False)
    run_root(["usermod", "-aG", "docker", user], check=False)
    print(f"user {user} has been added to docker group; log out/in to refresh access")


def compose_command() -> list[str]:
    result = run(["docker", "compose", "version"], check=False, capture=True)
    if result.returncode == 0:
        return ["docker", "compose"]
    if command_exists("docker-compose"):
        return ["docker-compose"]
    raise RuntimeError("Docker Compose is not available")


def ensure_network(name: str, *, external: bool) -> None:
    if not name:
        return
    result = run(["docker", "network", "inspect", name], check=False, capture=True)
    if result.returncode == 0:
        return
    driver = "bridge"
    run(["docker", "network", "create", "--driver", driver, name])
    if external:
        print(f"created external compose network {name}")


def ensure_directories() -> None:
    (ROOT / "data" / "backend").mkdir(parents=True, exist_ok=True)
    (ROOT / "images").mkdir(parents=True, exist_ok=True)
    (ROOT / "caddy" / "certs").mkdir(parents=True, exist_ok=True)


def apply_sysctl() -> None:
    if os.name != "posix":
        return
    settings = {
        "net.core.rmem_max": "26214400",
        "net.core.wmem_max": "26214400",
        "net.core.rmem_default": "1048576",
        "net.core.wmem_default": "1048576",
        "net.ipv4.ip_local_port_range": "1024 65535",
    }
    lines = [f"{key}={value}" for key, value in settings.items()]
    temp = Path("/tmp/99-meet37.conf")
    temp.write_text("\n".join(lines) + "\n", encoding="utf-8")
    run_root(["cp", str(temp), "/etc/sysctl.d/99-meet37.conf"], check=False)
    run_root(["sysctl", "--system"], check=False)


def firewall_rules(values: dict[str, str], include_app_ports: bool) -> list[tuple[str, str]]:
    rules = [
        ("80", "tcp"),
        ("443", "tcp"),
        (values["TURN_HOST_PORT"], "tcp"),
        (values["TURN_HOST_PORT"], "udp"),
        (f"{values['TURN_RELAY_PORT_MIN']}:{values['TURN_RELAY_PORT_MAX']}", "tcp"),
        (f"{values['TURN_RELAY_PORT_MIN']}:{values['TURN_RELAY_PORT_MAX']}", "udp"),
        (
            f"{values['WEBRTC_UDP_HOST_PORT_MIN']}:{values['WEBRTC_UDP_HOST_PORT_MAX']}",
            "udp",
        ),
    ]
    if include_app_ports:
        rules.extend(
            [
                (values["FRONTEND_HOST_PORT"], "tcp"),
                (values["BACKEND_HOST_PORT"], "tcp"),
            ]
        )
    return rules


def configure_firewall(values: dict[str, str], include_app_ports: bool) -> None:
    rules = firewall_rules(values, include_app_ports)
    if command_exists("ufw"):
        status = run(["ufw", "status"], check=False, capture=True)
        if "Status: active" in status.stdout:
            for port, proto in rules:
                run_root(["ufw", "allow", f"{port}/{proto}"], check=False)
            run_root(["ufw", "reload"], check=False)
            return

    if command_exists("firewall-cmd"):
        state = run(["firewall-cmd", "--state"], check=False, capture=True)
        if state.returncode == 0 and state.stdout.strip() == "running":
            for port, proto in rules:
                run_root(
                    [
                        "firewall-cmd",
                        "--permanent",
                        f"--add-port={port.replace(':', '-')}/{proto}",
                    ],
                    check=False,
                )
            run_root(["firewall-cmd", "--reload"], check=False)
            return

    print("no active ufw/firewalld detected; firewall was not changed")
    print("required ports:")
    for port, proto in rules:
        print(f"  {port}/{proto}")


def port_available(port: int, udp: bool = False) -> bool:
    sock_type = socket.SOCK_DGRAM if udp else socket.SOCK_STREAM
    with socket.socket(socket.AF_INET, sock_type) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("0.0.0.0", port))
        except OSError:
            return False
    return True


def check_ports(values: dict[str, str], include_app_ports: bool) -> None:
    warnings: list[str] = []
    for port, proto in firewall_rules(values, include_app_ports):
        if ":" in port:
            start, end = [int(item) for item in port.split(":", 1)]
            sample = range(start, min(end, start + 20) + 1)
            if not all(port_available(item, udp=proto == "udp") for item in sample):
                warnings.append(f"{port}/{proto} may already be in use")
            continue
        if not port_available(int(port), udp=proto == "udp"):
            warnings.append(f"{port}/{proto} may already be in use")
    for warning in warnings:
        print(f"warning: {warning}")


def validate_compose(compose_file: Path, env_file: Path) -> None:
    compose = compose_command()
    run([*compose, "--env-file", str(env_file), "-f", str(compose_file), "config", "-q"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare a server for meet37.")
    parser.add_argument("--env-file", default=str(DEFAULT_ENV_FILE))
    parser.add_argument("--env-example", default=str(DEFAULT_ENV_EXAMPLE))
    parser.add_argument("--compose-file", default=str(DEFAULT_COMPOSE_FILE))
    parser.add_argument("--public-ip", default="")
    parser.add_argument("--public-origin", default="")
    parser.add_argument("--install-docker", action="store_true")
    parser.add_argument("--docker-user", default="")
    parser.add_argument("--skip-firewall", action="store_true")
    parser.add_argument("--skip-sysctl", action="store_true")
    parser.add_argument(
        "--include-app-ports",
        action="store_true",
        help="Also open direct frontend/backend host ports. Not needed for Caddy production compose.",
    )
    parser.add_argument("--skip-app-ports", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--restart", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env_file = Path(args.env_file).resolve()
    env_example = Path(args.env_example).resolve()
    compose_file = Path(args.compose_file).resolve()

    try:
        if os.name != "posix":
            raise RuntimeError("prepare_server.py is intended for Linux servers")
        install_docker_if_needed(args)
        ensure_docker_running()
        ensure_docker_access(args)
        ensure_env_file(env_file, env_example)
        values = normalize_env(
            {**parse_env_file(env_example), **parse_env_file(env_file)}, args
        )
        write_env_file(env_file, values)
        ensure_directories()
        ensure_network(values["DOCKER_INTERNAL_NETWORK"], external=False)
        include_app_ports = args.include_app_ports and not args.skip_app_ports
        check_ports(values, include_app_ports=include_app_ports)
        if not args.skip_sysctl:
            apply_sysctl()
        if not args.skip_firewall:
            configure_firewall(values, include_app_ports=include_app_ports)
        validate_compose(compose_file, env_file)
        if args.restart:
            compose = compose_command()
            run([*compose, "--env-file", str(env_file), "-f", str(compose_file), "up", "-d"])
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"failed: {exc}", file=sys.stderr)
        return 1

    print("\nmeet37 server is prepared.")
    print(f"Env file: {env_file}")
    print(f"Compose file: {compose_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
