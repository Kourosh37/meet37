#!/usr/bin/env python3
"""Create and restore meet37 production backups."""

from __future__ import annotations

import argparse
import subprocess
import sys
import tarfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COMPOSE_FILE = ROOT / "docker-compose.prod.yml"
DEFAULT_OUTPUT_DIR = ROOT / "backups"
DEFAULT_INCLUDE = [".env", "docker-compose.prod.yml", "data"]


def run(command: list[str], *, cwd: Path = ROOT, check: bool = True) -> None:
    print("+ " + " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=check)


def compose_command() -> list[str]:
    result = subprocess.run(
        ["docker", "compose", "version"],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return ["docker", "compose"]
    return ["docker-compose"]


def safe_resolve(path: Path) -> Path:
    resolved = path.resolve()
    if not str(resolved).startswith(str(ROOT)):
        raise RuntimeError(f"refusing path outside workspace: {resolved}")
    return resolved


def create_backup(output_dir: Path, includes: list[str], stop_services: bool) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / f"meet37-backup-{time.strftime('%Y%m%d-%H%M%S')}.tar.gz"
    compose = compose_command()

    if stop_services:
        run([*compose, "-f", str(DEFAULT_COMPOSE_FILE), "down"], check=False)

    try:
        with tarfile.open(archive, "w:gz") as tar:
            for item in includes:
                path = ROOT / item
                if path.exists():
                    print(f"adding {item}")
                    tar.add(path, arcname=item)
                else:
                    print(f"skipping missing {item}")
    finally:
        if stop_services:
            run([*compose, "-f", str(DEFAULT_COMPOSE_FILE), "up", "-d"], check=False)

    return archive


def restore_backup(archive: Path, yes: bool) -> None:
    if not yes:
        raise RuntimeError("restore requires --yes")
    archive = safe_resolve(archive)
    if not archive.exists():
        raise RuntimeError(f"backup archive not found: {archive}")

    with tarfile.open(archive, "r:gz") as tar:
        for member in tar.getmembers():
            target = (ROOT / member.name).resolve()
            if not str(target).startswith(str(ROOT)):
                raise RuntimeError(f"unsafe archive path: {member.name}")
        tar.extractall(ROOT)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backup or restore meet37 data.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--include", action="append", default=[])
    parser.add_argument("--stop-services", action="store_true")
    parser.add_argument("--restore", default="")
    parser.add_argument("--yes", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.restore:
            restore_backup(Path(args.restore), args.yes)
            print("Restore completed.")
            return 0

        includes = args.include or DEFAULT_INCLUDE
        archive = create_backup(Path(args.output_dir), includes, args.stop_services)
        print(f"Backup created: {archive}")
        return 0
    except (RuntimeError, subprocess.CalledProcessError, tarfile.TarError) as exc:
        print(f"failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
