#!/usr/bin/env python3
"""Build a self-contained Docker offline bundle for this project.

The generated zip contains one top-level directory with:
  images/
  docker-compose.yml
  .env
  data/

Docker Compose cannot load image tarballs by itself. The bundle therefore also
places small load helpers inside images/ so an offline server can import the
saved images before running `docker compose up -d`.

The generated compose follows the server layout used by the existing apps:
  /opt/<app>/
    images/
    data/
    .env
    docker-compose.yml

Caddy is intentionally not bundled. The frontend joins the external `proxy`
network and Caddy can reverse-proxy to `<app>:3000`.
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import textwrap
import time
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BUNDLE_NAME = "meet37"
DEFAULT_APP_NAME = "meet37"
DEFAULT_PROXY_NETWORK = "proxy"


def run(command: list[str], *, cwd: Path = ROOT) -> None:
    print("+ " + " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def capture(command: list[str], *, cwd: Path = ROOT) -> str:
    return subprocess.check_output(command, cwd=cwd, text=True).strip()


def require_docker() -> None:
    try:
        run(["docker", "version"])
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        raise SystemExit("Docker is required and must be running.") from exc


def get_git_version() -> str:
    try:
        return capture(["git", "rev-parse", "--short", "HEAD"])
    except (FileNotFoundError, subprocess.CalledProcessError):
        return time.strftime("%Y%m%d%H%M%S")


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


def find_free_port(preferred: int, used: set[int]) -> int:
    candidates = [preferred, *range(preferred + 1, preferred + 200)]

    for port in candidates:
        if port in used:
            continue
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.2)
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                used.add(port)
                return port

    raise SystemExit(f"Could not find a free port near {preferred}.")


def normalize_domain(value: str) -> str:
    value = value.strip()
    if not value:
        return "meet37.dev37.ir"
    return value.removeprefix("http://").removeprefix("https://").strip("/")


def build_env(args: argparse.Namespace) -> dict[str, str]:
    example = parse_env_file(ROOT / ".env.example")
    current = parse_env_file(ROOT / ".env")
    env = {**example, **current}
    used_ports: set[int] = set()

    turn_host_port = args.turn_port or find_free_port(
        int(env.get("TURN_PORT", "3478")), used_ports
    )
    public_host = normalize_domain(args.domain or args.public_host)
    public_origin = f"https://{public_host}"

    env.update(
        {
            "PORT": "8080",
            "ENV": "production",
            "ADMIN_USERNAME": env.get("ADMIN_USERNAME") or "admin",
            "ADMIN_PASSWORD": env.get("ADMIN_PASSWORD")
            or secrets.token_urlsafe(18),
            "JWT_SECRET": env.get("JWT_SECRET")
            if env.get("JWT_SECRET")
            and env.get("JWT_SECRET") != "replace_with_a_long_random_secret"
            else secrets.token_urlsafe(48),
            "DEFAULT_APP_MODE": env.get("DEFAULT_APP_MODE", "public"),
            "TURN_PUBLIC_IP": env.get("TURN_PUBLIC_IP")
            if env.get("TURN_PUBLIC_IP")
            and env.get("TURN_PUBLIC_IP") != "127.0.0.1"
            else public_host,
            "TURN_PORT": str(turn_host_port),
            "TURN_SECRET": env.get("TURN_SECRET")
            if env.get("TURN_SECRET")
            and env.get("TURN_SECRET") != "another_random_secret_for_turn"
            else secrets.token_urlsafe(36),
            "DB_PATH": "/data/meet.db",
            "SFU_FALLBACK_THRESHOLD_KBPS": env.get(
                "SFU_FALLBACK_THRESHOLD_KBPS", "1500"
            ),
            "ALLOWED_ORIGINS": public_origin,
            "ACCESS_TOKEN_TTL_MINUTES": env.get("ACCESS_TOKEN_TTL_MINUTES", "15"),
            "REFRESH_TOKEN_TTL_DAYS": env.get("REFRESH_TOKEN_TTL_DAYS", "30"),
            "RATE_LIMIT_RPS": env.get("RATE_LIMIT_RPS", "20"),
            "RATE_LIMIT_BURST": env.get("RATE_LIMIT_BURST", "60"),
            "MAX_BODY_BYTES": env.get("MAX_BODY_BYTES", "1048576"),
            "SFU_RECORDING_ENABLED": env.get("SFU_RECORDING_ENABLED", "false"),
            "SFU_RECORDING_PATH": "/data/recordings",
            "WEBRTC_UDP_PORT_MIN": str(args.webrtc_udp_min),
            "WEBRTC_UDP_PORT_MAX": str(args.webrtc_udp_max),
            "REDIS_URL": env.get("REDIS_URL", ""),
            "INSTANCE_ID": env.get("INSTANCE_ID") or args.app_name,
            "TURN_HOST_PORT": str(turn_host_port),
            "APP_NAME": args.app_name,
            "PUBLIC_DOMAIN": public_host,
            "PUBLIC_ORIGIN": public_origin,
            "PROXY_NETWORK": args.proxy_network,
            "NEXT_PUBLIC_API_BASE_URL": "browser-origin",
            "NEXT_PUBLIC_WS_URL": "browser-origin",
            "NEXT_PUBLIC_TURN_PUBLIC_IP": public_host,
        }
    )
    env["ALLOWED_ORIGINS"] = (
        env.get("ALLOWED_ORIGINS")
        if env.get("ALLOWED_ORIGINS") and env.get("ALLOWED_ORIGINS") != "*"
        else public_origin
    )
    return env


def write_env(path: Path, env: dict[str, str]) -> None:
    ordered_keys = [
        "APP_NAME",
        "PUBLIC_DOMAIN",
        "PUBLIC_ORIGIN",
        "PROXY_NETWORK",
        "PORT",
        "TURN_HOST_PORT",
        "ENV",
        "ADMIN_USERNAME",
        "ADMIN_PASSWORD",
        "JWT_SECRET",
        "DEFAULT_APP_MODE",
        "TURN_PUBLIC_IP",
        "TURN_PORT",
        "TURN_SECRET",
        "DB_PATH",
        "SFU_FALLBACK_THRESHOLD_KBPS",
        "ALLOWED_ORIGINS",
        "ACCESS_TOKEN_TTL_MINUTES",
        "REFRESH_TOKEN_TTL_DAYS",
        "RATE_LIMIT_RPS",
        "RATE_LIMIT_BURST",
        "MAX_BODY_BYTES",
        "SFU_RECORDING_ENABLED",
        "SFU_RECORDING_PATH",
        "WEBRTC_UDP_PORT_MIN",
        "WEBRTC_UDP_PORT_MAX",
        "REDIS_URL",
        "INSTANCE_ID",
        "NEXT_PUBLIC_API_BASE_URL",
        "NEXT_PUBLIC_WS_URL",
        "NEXT_PUBLIC_TURN_PUBLIC_IP",
    ]
    lines = ["# Generated offline deployment environment"]
    lines.extend(f"{key}={env.get(key, '')}" for key in ordered_keys)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def compose_yaml(backend_image: str, frontend_image: str, app_name: str) -> str:
    backend_name = f"{app_name}-backend"
    frontend_name = app_name
    internal_network = f"{app_name}_internal"
    return textwrap.dedent(
        f"""\
        services:
          backend:
            image: {backend_image}
            container_name: {backend_name}
            pull_policy: never
            env_file:
              - ./.env
            ports:
              - "${{TURN_HOST_PORT:-3478}}:${{TURN_PORT:-3478}}/udp"
              - "${{TURN_HOST_PORT:-3478}}:${{TURN_PORT:-3478}}/tcp"
              - "${{WEBRTC_UDP_PORT_MIN:-40000}}-${{WEBRTC_UDP_PORT_MAX:-40100}}:${{WEBRTC_UDP_PORT_MIN:-40000}}-${{WEBRTC_UDP_PORT_MAX:-40100}}/udp"
            volumes:
              - ./data/backend:/data
            healthcheck:
              test: ["CMD-SHELL", "wget -qO- http://localhost:$${{PORT:-8080}}/health || exit 1"]
              interval: 30s
              timeout: 5s
              retries: 5
            networks:
              - internal
            restart: unless-stopped

          frontend:
            image: {frontend_image}
            container_name: {frontend_name}
            pull_policy: never
            env_file:
              - ./.env
            environment:
              NEXT_PUBLIC_API_BASE_URL: ${{NEXT_PUBLIC_API_BASE_URL}}
              NEXT_PUBLIC_WS_URL: ${{NEXT_PUBLIC_WS_URL}}
              NEXT_PUBLIC_TURN_PUBLIC_IP: ${{NEXT_PUBLIC_TURN_PUBLIC_IP}}
              BACKEND_INTERNAL_URL: http://{backend_name}:${{PORT:-8080}}
            depends_on:
              backend:
                condition: service_healthy
            networks:
              - proxy
              - internal
            restart: unless-stopped

        networks:
          proxy:
            external: true
            name: ${{PROXY_NETWORK:-proxy}}

          internal:
            name: {internal_network}
            driver: bridge
        """
    )


def caddy_snippet(domain: str, app_name: str) -> str:
    return textwrap.dedent(
        f"""\
        # Add this block to /opt/caddy/Caddyfile, then run:
        #   cd /opt/caddy && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

        {domain} {{
            tls /etc/caddy/certs/fullchain.pem /etc/caddy/certs/privkey.pem {{
                protocols tls1.2
            }}
            reverse_proxy {app_name}:3000
        }}
        """
    )


def build_images(env: dict[str, str], version: str) -> tuple[str, str]:
    backend_image = f"meet37-backend:{version}"
    frontend_image = f"meet37-frontend:{version}"

    run(["docker", "build", "-t", backend_image, "-f", "backend/Dockerfile", "backend"])
    run(
        [
            "docker",
            "build",
            "-t",
            frontend_image,
            "-f",
            "frontend/Dockerfile",
            "--build-arg",
            f"NEXT_PUBLIC_API_BASE_URL={env['NEXT_PUBLIC_API_BASE_URL']}",
            "--build-arg",
            f"NEXT_PUBLIC_WS_URL={env['NEXT_PUBLIC_WS_URL']}",
            "--build-arg",
            f"NEXT_PUBLIC_TURN_PUBLIC_IP={env['NEXT_PUBLIC_TURN_PUBLIC_IP']}",
            "--build-arg",
            f"BACKEND_INTERNAL_URL=http://{env['APP_NAME']}-backend:{env['PORT']}",
            "frontend",
        ]
    )
    return backend_image, frontend_image


def save_image(image: str, destination: Path) -> None:
    safe_name = image.replace("/", "_").replace(":", "_")
    tar_path = destination / f"{safe_name}.tar"
    gz_path = destination / f"{safe_name}.tar.gz"

    run(["docker", "save", "-o", str(tar_path), image])
    with tar_path.open("rb") as source, gzip.open(gz_path, "wb", compresslevel=9) as target:
        shutil.copyfileobj(source, target)
    tar_path.unlink()


def write_load_helpers(images_dir: Path) -> None:
    (images_dir / "load-images.sh").write_text(
        textwrap.dedent(
            """\
            #!/usr/bin/env sh
            set -eu
            cd "$(dirname "$0")"
            for image in *.tar.gz; do
              [ -f "$image" ] || continue
              echo "Loading $image"
              docker load -i "$image"
            done
            """
        ),
        encoding="utf-8",
    )
    (images_dir / "load-images.ps1").write_text(
        textwrap.dedent(
            """\
            $ErrorActionPreference = "Stop"
            Set-Location $PSScriptRoot
            Get-ChildItem -Filter *.tar.gz | ForEach-Object {
              Write-Host "Loading $($_.Name)"
              docker load -i $_.FullName
            }
            """
        ),
        encoding="utf-8",
    )
    (images_dir / "run-offline.py").write_text(
        textwrap.dedent(
            """\
            #!/usr/bin/env python3
            from __future__ import annotations

            import socket
            import subprocess
            from pathlib import Path


            ROOT = Path(__file__).resolve().parents[1]
            ENV_PATH = ROOT / ".env"
            IMAGES_DIR = ROOT / "images"


            def parse_env(path: Path) -> dict[str, str]:
                values: dict[str, str] = {}
                for raw_line in path.read_text(encoding="utf-8").splitlines():
                    line = raw_line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    values[key] = value
                return values


            def write_env(path: Path, values: dict[str, str]) -> None:
                existing = path.read_text(encoding="utf-8").splitlines()
                seen: set[str] = set()
                output: list[str] = []

                for raw_line in existing:
                    stripped = raw_line.strip()
                    if not stripped or stripped.startswith("#") or "=" not in stripped:
                        output.append(raw_line)
                        continue
                    key, _value = stripped.split("=", 1)
                    if key in values:
                        output.append(f"{key}={values[key]}")
                        seen.add(key)
                    else:
                        output.append(raw_line)

                for key, value in values.items():
                    if key not in seen:
                        output.append(f"{key}={value}")

                path.write_text("\\n".join(output) + "\\n", encoding="utf-8")


            def is_free(port: int) -> bool:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                    sock.settimeout(0.2)
                    return sock.connect_ex(("127.0.0.1", port)) != 0


            def find_free(preferred: int, used: set[int]) -> int:
                for port in [preferred, *range(preferred + 1, preferred + 200)]:
                    if port in used:
                        continue
                    if is_free(port):
                        used.add(port)
                        return port
                raise SystemExit(f"No free port found near {preferred}")


            def run(command: list[str], cwd: Path = ROOT) -> None:
                print("+ " + " ".join(command), flush=True)
                subprocess.run(command, cwd=cwd, check=True)


            def ensure_proxy_network(name: str) -> None:
                result = subprocess.run(
                    ["docker", "network", "inspect", name],
                    cwd=ROOT,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                if result.returncode != 0:
                    run(["docker", "network", "create", name])


            def load_images() -> None:
                for image in sorted(IMAGES_DIR.glob("*.tar.gz")):
                    run(["docker", "load", "-i", str(image)])


            def main() -> int:
                env = parse_env(ENV_PATH)
                used: set[int] = set()
                turn_port = find_free(int(env.get("TURN_HOST_PORT", "3478")), used)

                env["TURN_HOST_PORT"] = str(turn_port)
                env["TURN_PORT"] = str(turn_port)

                host = env.get("PUBLIC_DOMAIN", env.get("NEXT_PUBLIC_TURN_PUBLIC_IP", "localhost"))
                env["TURN_PUBLIC_IP"] = host
                env["NEXT_PUBLIC_TURN_PUBLIC_IP"] = host
                env["NEXT_PUBLIC_API_BASE_URL"] = "browser-origin"
                env["NEXT_PUBLIC_WS_URL"] = "browser-origin"
                env["ALLOWED_ORIGINS"] = env.get("PUBLIC_ORIGIN") or f"https://{host}"
                write_env(ENV_PATH, env)

                ensure_proxy_network(env.get("PROXY_NETWORK", "proxy"))
                load_images()
                run(["docker", "compose", "up", "-d"])
                print(f"App container is available to Caddy as: {env.get('APP_NAME', 'meet37')}:3000")
                print(f"Add Caddy reverse_proxy target: {env.get('APP_NAME', 'meet37')}:3000")
                return 0


            if __name__ == "__main__":
                raise SystemExit(main())
            """
        ),
        encoding="utf-8",
    )


def write_manifest(
    images_dir: Path,
    *,
    backend_image: str,
    frontend_image: str,
    env: dict[str, str],
    version: str,
) -> None:
    manifest = {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "version": version,
        "images": [backend_image, frontend_image],
        "ports": {
            "turn": env["TURN_HOST_PORT"],
            "webrtc_udp": f"{env['WEBRTC_UDP_PORT_MIN']}-{env['WEBRTC_UDP_PORT_MAX']}",
        },
        "caddy": {
            "domain": env["PUBLIC_DOMAIN"],
            "reverse_proxy": f"{env['APP_NAME']}:3000",
            "network": env["PROXY_NETWORK"],
        },
        "start": [
            "python images/run-offline.py",
            "or:",
            "sh images/load-images.sh",
            "docker compose up -d",
        ],
    }
    (images_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


def zip_directory(source_dir: Path, output_zip: Path) -> None:
    output_zip.parent.mkdir(parents=True, exist_ok=True)
    if output_zip.exists():
        output_zip.unlink()

    with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source_dir.rglob("*")):
            archive.write(path, path.relative_to(source_dir.parent))


def create_bundle(args: argparse.Namespace) -> Path:
    require_docker()

    version = args.version or get_git_version()
    env = build_env(args)
    backend_image, frontend_image = build_images(env, version)
    output_zip = Path(args.output).resolve()

    with tempfile.TemporaryDirectory(prefix="meet37-offline-") as temp_name:
        temp_root = Path(temp_name)
        bundle_dir = temp_root / args.bundle_name
        images_dir = bundle_dir / "images"
        data_dir = bundle_dir / "data"
        backend_data_dir = data_dir / "backend"
        recordings_dir = backend_data_dir / "recordings"

        images_dir.mkdir(parents=True)
        recordings_dir.mkdir(parents=True)
        (data_dir / ".gitkeep").write_text("", encoding="utf-8")
        (backend_data_dir / ".gitkeep").write_text("", encoding="utf-8")
        (recordings_dir / ".gitkeep").write_text("", encoding="utf-8")

        write_env(bundle_dir / ".env", env)
        (bundle_dir / "docker-compose.yml").write_text(
            compose_yaml(backend_image, frontend_image, args.app_name), encoding="utf-8"
        )
        (bundle_dir / "Caddyfile.snippet").write_text(
            caddy_snippet(env["PUBLIC_DOMAIN"], args.app_name),
            encoding="utf-8",
        )
        save_image(backend_image, images_dir)
        save_image(frontend_image, images_dir)
        write_load_helpers(images_dir)
        write_manifest(
            images_dir,
            backend_image=backend_image,
            frontend_image=frontend_image,
            env=env,
            version=version,
        )

        zip_directory(bundle_dir, output_zip)

    return output_zip


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a zip bundle for offline Docker Compose deployment."
    )
    parser.add_argument(
        "--output",
        default=str(ROOT / "dist" / "meet37-offline.zip"),
        help="Path to the generated zip file.",
    )
    parser.add_argument(
        "--bundle-name",
        default=DEFAULT_BUNDLE_NAME,
        help="Top-level directory name inside the zip.",
    )
    parser.add_argument(
        "--version",
        default="",
        help="Docker image tag. Defaults to the current git short SHA.",
    )
    parser.add_argument(
        "--public-host",
        default=os.environ.get("OFFLINE_PUBLIC_HOST", "localhost"),
        help="Deprecated alias for --domain.",
    )
    parser.add_argument(
        "--domain",
        default=os.environ.get("MEET37_DOMAIN", "meet37.dev37.ir"),
        help="Public HTTPS domain served by the external Caddy instance.",
    )
    parser.add_argument(
        "--app-name",
        default=os.environ.get("MEET37_APP_NAME", DEFAULT_APP_NAME),
        help="Compose service/container name exposed to Caddy on the proxy network.",
    )
    parser.add_argument(
        "--proxy-network",
        default=os.environ.get("MEET37_PROXY_NETWORK", DEFAULT_PROXY_NETWORK),
        help="External Docker network used by Caddy.",
    )
    parser.add_argument(
        "--turn-port",
        type=int,
        default=0,
        help="Host port for TURN/SFU relay. Defaults to a free port near TURN_PORT.",
    )
    parser.add_argument(
        "--webrtc-udp-min",
        type=int,
        default=int(os.environ.get("MEET37_WEBRTC_UDP_MIN", "42000")),
        help="First UDP media relay port published on the host.",
    )
    parser.add_argument(
        "--webrtc-udp-max",
        type=int,
        default=int(os.environ.get("MEET37_WEBRTC_UDP_MAX", "42100")),
        help="Last UDP media relay port published on the host.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        output_zip = create_bundle(args)
    except subprocess.CalledProcessError as exc:
        print(f"Command failed with exit code {exc.returncode}.", file=sys.stderr)
        return exc.returncode

    print(f"\nOffline bundle created: {output_zip}")
    print("On the offline server:")
    print("  1. unzip the bundle")
    print(f"  2. cd {args.bundle_name}")
    print("  3. sh images/load-images.sh")
    print("  4. docker compose up -d")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
