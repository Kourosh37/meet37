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
DEFAULT_BUNDLE_NAME = "meet37-offline"


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


def public_host_for_urls(public_host: str) -> str:
    public_host = public_host.strip()
    if not public_host:
        return "localhost"
    return public_host.removeprefix("http://").removeprefix("https://")


def build_env(args: argparse.Namespace) -> dict[str, str]:
    example = parse_env_file(ROOT / ".env.example")
    current = parse_env_file(ROOT / ".env")
    env = {**example, **current}
    used_ports: set[int] = set()

    frontend_host_port = args.frontend_port or find_free_port(3000, used_ports)
    turn_host_port = args.turn_port or find_free_port(
        int(env.get("TURN_PORT", "3478")), used_ports
    )
    public_host = public_host_for_urls(args.public_host)

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
            "ALLOWED_ORIGINS": env.get("ALLOWED_ORIGINS")
            if env.get("ALLOWED_ORIGINS") and env.get("ALLOWED_ORIGINS") != "*"
            else f"http://{public_host}:{frontend_host_port}",
            "ACCESS_TOKEN_TTL_MINUTES": env.get("ACCESS_TOKEN_TTL_MINUTES", "15"),
            "REFRESH_TOKEN_TTL_DAYS": env.get("REFRESH_TOKEN_TTL_DAYS", "30"),
            "RATE_LIMIT_RPS": env.get("RATE_LIMIT_RPS", "20"),
            "RATE_LIMIT_BURST": env.get("RATE_LIMIT_BURST", "60"),
            "MAX_BODY_BYTES": env.get("MAX_BODY_BYTES", "1048576"),
            "SFU_RECORDING_ENABLED": env.get("SFU_RECORDING_ENABLED", "false"),
            "SFU_RECORDING_PATH": "/data/recordings",
            "REDIS_URL": env.get("REDIS_URL", ""),
            "INSTANCE_ID": env.get("INSTANCE_ID", ""),
            "FRONTEND_HOST_PORT": str(frontend_host_port),
            "TURN_HOST_PORT": str(turn_host_port),
            "NEXT_PUBLIC_API_BASE_URL": "browser-origin",
            "NEXT_PUBLIC_WS_URL": "browser-origin",
            "NEXT_PUBLIC_TURN_PUBLIC_IP": public_host,
        }
    )
    return env


def write_env(path: Path, env: dict[str, str]) -> None:
    ordered_keys = [
        "PORT",
        "FRONTEND_HOST_PORT",
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
        "REDIS_URL",
        "INSTANCE_ID",
        "NEXT_PUBLIC_API_BASE_URL",
        "NEXT_PUBLIC_WS_URL",
        "NEXT_PUBLIC_TURN_PUBLIC_IP",
    ]
    lines = ["# Generated offline deployment environment"]
    lines.extend(f"{key}={env.get(key, '')}" for key in ordered_keys)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def compose_yaml(backend_image: str, frontend_image: str, proxy_image: str) -> str:
    return textwrap.dedent(
        f"""\
        services:
          backend:
            image: {backend_image}
            pull_policy: never
            env_file:
              - ./.env
            expose:
              - "${{PORT:-8080}}"
            ports:
              - "${{TURN_HOST_PORT:-3478}}:${{TURN_PORT:-3478}}/udp"
              - "${{TURN_HOST_PORT:-3478}}:${{TURN_PORT:-3478}}/tcp"
            volumes:
              - ./data:/data
            healthcheck:
              test: ["CMD-SHELL", "wget -qO- http://localhost:$${{PORT:-8080}}/health || exit 1"]
              interval: 30s
              timeout: 5s
              retries: 5
            restart: unless-stopped

          frontend:
            image: {frontend_image}
            pull_policy: never
            env_file:
              - ./.env
            environment:
              NEXT_PUBLIC_API_BASE_URL: ${{NEXT_PUBLIC_API_BASE_URL}}
              NEXT_PUBLIC_WS_URL: ${{NEXT_PUBLIC_WS_URL}}
              NEXT_PUBLIC_TURN_PUBLIC_IP: ${{NEXT_PUBLIC_TURN_PUBLIC_IP}}
            expose:
              - "3000"
            depends_on:
              backend:
                condition: service_healthy
            restart: unless-stopped

          proxy:
            image: {proxy_image}
            pull_policy: never
            ports:
              - "${{FRONTEND_HOST_PORT:-3000}}:80"
            volumes:
              - ./data/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
            depends_on:
              backend:
                condition: service_healthy
              frontend:
                condition: service_started
            restart: unless-stopped
        """
    )


def build_images(env: dict[str, str], version: str) -> tuple[str, str, str]:
    backend_image = f"meet37/backend:{version}"
    frontend_image = f"meet37/frontend:{version}"
    proxy_image = "nginx:1.27-alpine"

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
            "frontend",
        ]
    )
    run(["docker", "pull", proxy_image])
    return backend_image, frontend_image, proxy_image


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


            def load_images() -> None:
                for image in sorted(IMAGES_DIR.glob("*.tar.gz")):
                    run(["docker", "load", "-i", str(image)])


            def main() -> int:
                env = parse_env(ENV_PATH)
                used: set[int] = set()
                frontend_port = find_free(int(env.get("FRONTEND_HOST_PORT", "3000")), used)
                turn_port = find_free(int(env.get("TURN_HOST_PORT", "3478")), used)

                env["FRONTEND_HOST_PORT"] = str(frontend_port)
                env["TURN_HOST_PORT"] = str(turn_port)
                env["TURN_PORT"] = str(turn_port)

                host = env.get("NEXT_PUBLIC_TURN_PUBLIC_IP", "localhost")
                env["NEXT_PUBLIC_API_BASE_URL"] = "browser-origin"
                env["NEXT_PUBLIC_WS_URL"] = "browser-origin"
                env["ALLOWED_ORIGINS"] = f"http://{host}:{frontend_port}"
                write_env(ENV_PATH, env)

                load_images()
                run(["docker", "compose", "up", "-d"])
                print(f"Frontend: http://{host}:{frontend_port}")
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
    proxy_image: str,
    env: dict[str, str],
    version: str,
) -> None:
    manifest = {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "version": version,
        "images": [backend_image, frontend_image, proxy_image],
        "ports": {
            "frontend": env["FRONTEND_HOST_PORT"],
            "turn": env["TURN_HOST_PORT"],
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


def nginx_config() -> str:
    return textwrap.dedent(
        """\
        server {
          listen 80;
          server_name _;
          client_max_body_size 50m;

          location /api/ {
            proxy_pass http://backend:8080/api/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
          }

          location /ws {
            proxy_pass http://backend:8080/ws;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 3600s;
          }

          location / {
            proxy_pass http://frontend:3000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
          }
        }
        """
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
    backend_image, frontend_image, proxy_image = build_images(env, version)
    output_zip = Path(args.output).resolve()

    with tempfile.TemporaryDirectory(prefix="meet37-offline-") as temp_name:
        temp_root = Path(temp_name)
        bundle_dir = temp_root / args.bundle_name
        images_dir = bundle_dir / "images"
        data_dir = bundle_dir / "data"
        recordings_dir = data_dir / "recordings"
        nginx_dir = data_dir / "nginx"

        images_dir.mkdir(parents=True)
        recordings_dir.mkdir(parents=True)
        nginx_dir.mkdir(parents=True)
        (data_dir / ".gitkeep").write_text("", encoding="utf-8")
        (recordings_dir / ".gitkeep").write_text("", encoding="utf-8")
        (nginx_dir / "default.conf").write_text(nginx_config(), encoding="utf-8")

        write_env(bundle_dir / ".env", env)
        (bundle_dir / "docker-compose.yml").write_text(
            compose_yaml(backend_image, frontend_image, proxy_image), encoding="utf-8"
        )
        save_image(backend_image, images_dir)
        save_image(frontend_image, images_dir)
        save_image(proxy_image, images_dir)
        write_load_helpers(images_dir)
        write_manifest(
            images_dir,
            backend_image=backend_image,
            frontend_image=frontend_image,
            proxy_image=proxy_image,
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
        help="Host/IP clients will use to open the offline server.",
    )
    parser.add_argument(
        "--frontend-port",
        type=int,
        default=0,
        help="Host port for frontend. Defaults to a free port near 3000.",
    )
    parser.add_argument(
        "--turn-port",
        type=int,
        default=0,
        help="Host port for TURN/SFU relay. Defaults to a free port near TURN_PORT.",
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
