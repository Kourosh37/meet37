#!/usr/bin/env python3
"""Build all meet37 Docker images and package them into one loadable archive."""

from __future__ import annotations

import argparse
import gzip
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = ROOT / ".env"
DEFAULT_ENV_EXAMPLE = ROOT / ".env.example"


def run(command: list[str], *, cwd: Path = ROOT) -> None:
    print("+ " + " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def capture(command: list[str], *, cwd: Path = ROOT) -> str:
    return subprocess.check_output(command, cwd=cwd, text=True).strip()


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


def get_git_version() -> str:
    try:
        return capture(["git", "rev-parse", "--short", "HEAD"])
    except (FileNotFoundError, subprocess.CalledProcessError):
        return time.strftime("%Y%m%d%H%M%S")


def split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def ordered_unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        output.append(value)
    return output


def require_docker() -> None:
    try:
        run(["docker", "version"])
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        raise SystemExit("Docker is required and must be running.") from exc


def build_application_images(args: argparse.Namespace, env: dict[str, str]) -> list[str]:
    version = args.version or env.get("DOCKER_IMAGE_TAG") or get_git_version()
    backend_name = args.backend_image or env.get("DOCKER_BACKEND_IMAGE", "meet37-backend")
    frontend_name = args.frontend_image or env.get("DOCKER_FRONTEND_IMAGE", "meet37-frontend")
    backend_image = f"{backend_name}:{version}"
    frontend_image = f"{frontend_name}:{version}"

    frontend_args = {
        "NEXT_PUBLIC_API_BASE_URL": args.api_base_url
        or env.get("NEXT_PUBLIC_API_BASE_URL")
        or "browser-origin",
        "NEXT_PUBLIC_WS_URL": args.ws_url
        or env.get("NEXT_PUBLIC_WS_URL")
        or "browser-origin",
        "NEXT_PUBLIC_TURN_PUBLIC_IP": args.turn_public_ip
        or env.get("NEXT_PUBLIC_TURN_PUBLIC_IP")
        or env.get("TURN_PUBLIC_IP")
        or "127.0.0.1",
        "BACKEND_INTERNAL_URL": args.backend_internal_url
        or env.get("BACKEND_INTERNAL_URL")
        or "http://backend:8080",
        "FRONTEND_PORT": args.frontend_port or env.get("FRONTEND_PORT") or "3000",
    }

    run(["docker", "build", "-t", backend_image, "-f", "backend/Dockerfile", "backend"])
    frontend_command = [
        "docker",
        "build",
        "-t",
        frontend_image,
        "-f",
        "frontend/Dockerfile",
    ]
    for key, value in frontend_args.items():
        frontend_command.extend(["--build-arg", f"{key}={value}"])
    frontend_command.append("frontend")
    run(frontend_command)
    return [backend_image, frontend_image]


def collect_runtime_images(args: argparse.Namespace, env: dict[str, str]) -> list[str]:
    images: list[str] = []
    coturn_image = args.coturn_image or env.get("COTURN_IMAGE", "coturn/coturn:latest")
    caddy_image = args.caddy_image or env.get("CADDY_IMAGE", "caddy:2-alpine")
    if coturn_image and not args.skip_coturn:
        images.append(coturn_image)
    if caddy_image and not args.skip_caddy:
        images.append(caddy_image)
    images.extend(split_csv(env.get("DOCKER_EXTRA_IMAGES", "")))
    images.extend(args.extra_image)
    images = ordered_unique(images)

    for image in images:
        run(["docker", "pull", image])
    return images


def package_images(images: list[str], archive: Path) -> None:
    archive.parent.mkdir(parents=True, exist_ok=True)
    if archive.exists():
        archive.unlink()

    with tempfile.TemporaryDirectory(prefix="meet37-images-") as temp_dir:
        tar_path = Path(temp_dir) / "meet37-images.tar"
        run(["docker", "save", "-o", str(tar_path), *images])
        with tar_path.open("rb") as source, gzip.open(
            archive, "wb", compresslevel=9
        ) as target:
            shutil.copyfileobj(source, target)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build backend/frontend images, pull runtime images, and write one "
            ".tar.gz archive that can be loaded with docker load."
        )
    )
    parser.add_argument("--env-file", default=str(DEFAULT_ENV_FILE))
    parser.add_argument("--env-example", default=str(DEFAULT_ENV_EXAMPLE))
    parser.add_argument("--output", default="")
    parser.add_argument("--output-dir", default="")
    parser.add_argument("--version", default="")
    parser.add_argument("--backend-image", default="")
    parser.add_argument("--frontend-image", default="")
    parser.add_argument("--coturn-image", default="")
    parser.add_argument("--caddy-image", default="")
    parser.add_argument("--extra-image", action="append", default=[])
    parser.add_argument("--skip-coturn", action="store_true")
    parser.add_argument("--skip-caddy", action="store_true")
    parser.add_argument("--api-base-url", default="")
    parser.add_argument("--ws-url", default="")
    parser.add_argument("--turn-public-ip", default="")
    parser.add_argument("--backend-internal-url", default="")
    parser.add_argument("--frontend-port", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    require_docker()

    env = {
        **parse_env_file(Path(args.env_example)),
        **parse_env_file(Path(args.env_file)),
    }
    version = args.version or env.get("DOCKER_IMAGE_TAG") or get_git_version()
    output_dir = Path(
        args.output_dir or env.get("DOCKER_IMAGE_OUTPUT_DIR") or "dist"
    ).resolve()
    archive = (
        Path(args.output).resolve()
        if args.output
        else output_dir / f"meet37-images-{version}.tar.gz"
    )

    try:
        images = build_application_images(args, env)
        images.extend(collect_runtime_images(args, env))
        images = ordered_unique(images)
        package_images(images, archive)
    except subprocess.CalledProcessError as exc:
        print(f"failed with exit code {exc.returncode}", file=sys.stderr)
        return exc.returncode

    print("\nCreated image bundle:")
    print(f"  {archive}")
    print("\nLoad on a server with:")
    print(f"  docker load -i {archive.name}")
    print("\nImages included:")
    for image in images:
        print(f"  {image}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
