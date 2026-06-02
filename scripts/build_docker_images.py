#!/usr/bin/env python3
"""Build meet37 Docker images and save them as .tar.gz files.

Output defaults to:
  dist/

The script only builds and exports images. It does not generate compose files,
environment files, Caddy snippets, or offline deployment bundles.
"""

from __future__ import annotations

import argparse
import gzip
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

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

def image_archive_name(image: str) -> str:
    return image.replace("/", "_").replace(":", "_") + ".tar.gz"

def save_image(image: str, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    tar_path = output_dir / image_archive_name(image).removesuffix(".gz")
    gz_path = output_dir / image_archive_name(image)

    if tar_path.exists():
        tar_path.unlink()
    if gz_path.exists():
        gz_path.unlink()

    run(["docker", "save", "-o", str(tar_path), image])
    with tar_path.open("rb") as source, gzip.open(gz_path, "wb", compresslevel=9) as target:
        shutil.copyfileobj(source, target)
    tar_path.unlink()
    return gz_path

def build_images(args: argparse.Namespace) -> tuple[str, str]:
    env = {**parse_env_file(ROOT / ".env.example"), **parse_env_file(ROOT / ".env")}
    version = args.version or env.get("DOCKER_IMAGE_TAG") or get_git_version()

    backend_image_name = args.backend_image or env.get("DOCKER_BACKEND_IMAGE")
    frontend_image_name = args.frontend_image or env.get("DOCKER_FRONTEND_IMAGE")

    if not backend_image_name or not frontend_image_name:
        raise SystemExit("DOCKER_BACKEND_IMAGE and DOCKER_FRONTEND_IMAGE are required.")

    backend_image = f"{backend_image_name}:{version}"
    frontend_image = f"{frontend_image_name}:{version}"

    public_api_base_url = args.api_base_url or env.get("NEXT_PUBLIC_API_BASE_URL")
    public_ws_url = args.ws_url or env.get("NEXT_PUBLIC_WS_URL")
    turn_public_ip = args.turn_public_ip or env.get("NEXT_PUBLIC_TURN_PUBLIC_IP")
    backend_internal_url = args.backend_internal_url or env.get("BACKEND_INTERNAL_URL")
    frontend_port = args.frontend_port or env.get("FRONTEND_PORT")

    missing = [
        key
        for key, value in {
            "NEXT_PUBLIC_API_BASE_URL": public_api_base_url,
            "NEXT_PUBLIC_WS_URL": public_ws_url,
            "NEXT_PUBLIC_TURN_PUBLIC_IP": turn_public_ip,
            "BACKEND_INTERNAL_URL": backend_internal_url,
            "FRONTEND_PORT": frontend_port,
        }.items()
        if not value
    ]
    if missing:
        raise SystemExit(f"Missing required environment values: {', '.join(missing)}")

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
            f"NEXT_PUBLIC_API_BASE_URL={public_api_base_url}",
            "--build-arg",
            f"NEXT_PUBLIC_WS_URL={public_ws_url}",
            "--build-arg",
            f"NEXT_PUBLIC_TURN_PUBLIC_IP={turn_public_ip}",
            "--build-arg",
            f"BACKEND_INTERNAL_URL={backend_internal_url}",
            "--build-arg",
            f"FRONTEND_PORT={frontend_port}",
            "frontend",
        ]
    )

    return backend_image, frontend_image

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build meet37 Docker images and save .tar.gz archives in dist."
    )
    parser.add_argument(
        "--output-dir",
        default="",
        help="Directory for generated .tar.gz image archives. Defaults to DOCKER_IMAGE_OUTPUT_DIR.",
    )
    parser.add_argument(
        "--version",
        default="",
        help="Docker image tag. Defaults to DOCKER_IMAGE_TAG or current git short SHA.",
    )
    parser.add_argument(
        "--backend-image",
        default="",
        help="Backend image repository/name without tag. Defaults to DOCKER_BACKEND_IMAGE.",
    )
    parser.add_argument(
        "--frontend-image",
        default="",
        help="Frontend image repository/name without tag. Defaults to DOCKER_FRONTEND_IMAGE.",
    )
    parser.add_argument(
        "--api-base-url",
        default="",
        help="Frontend NEXT_PUBLIC_API_BASE_URL build arg. Defaults to .env.",
    )
    parser.add_argument(
        "--ws-url",
        default="",
        help="Frontend NEXT_PUBLIC_WS_URL build arg. Defaults to .env.",
    )
    parser.add_argument(
        "--turn-public-ip",
        default="",
        help="Frontend NEXT_PUBLIC_TURN_PUBLIC_IP build arg. Defaults to .env.",
    )
    parser.add_argument(
        "--backend-internal-url",
        default="",
        help="Frontend BACKEND_INTERNAL_URL build arg. Defaults to .env.",
    )
    parser.add_argument(
        "--frontend-port",
        default="",
        help="Frontend PORT build arg. Defaults to FRONTEND_PORT from .env.",
    )
    return parser.parse_args()

def main() -> int:
    args = parse_args()
    require_docker()
    env = {**parse_env_file(ROOT / ".env.example"), **parse_env_file(ROOT / ".env")}
    output_dir_value = args.output_dir or env.get("DOCKER_IMAGE_OUTPUT_DIR")
    if not output_dir_value:
        raise SystemExit("DOCKER_IMAGE_OUTPUT_DIR is required.")

    try:
        images = build_images(args)
        output_dir = Path(output_dir_value).resolve()
        archives = [save_image(image, output_dir) for image in images]
    except subprocess.CalledProcessError as exc:
        print(f"Command failed with exit code {exc.returncode}.", file=sys.stderr)
        return exc.returncode

    print("\nDocker image archives created:")
    for archive in archives:
        print(f"  {archive}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
