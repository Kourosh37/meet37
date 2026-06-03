#!/usr/bin/env python3
"""Load meet37 Docker image archives from an images directory."""

from __future__ import annotations

import argparse
import gzip
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IMAGES_DIR = ROOT / "images"


def load_archive(archive: Path) -> None:
    print(f"+ gzip -dc {archive} | docker load", flush=True)
    with gzip.open(archive, "rb") as source:
        process = subprocess.run(["docker", "load"], stdin=source, check=True)
    if process.returncode != 0:
        raise subprocess.CalledProcessError(process.returncode, ["docker", "load"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load meet37 Docker image archives.")
    parser.add_argument(
        "--images-dir",
        default=str(DEFAULT_IMAGES_DIR),
        help="Directory containing .tar.gz image archives. Defaults to ./images.",
    )
    parser.add_argument(
        "--archive",
        action="append",
        default=[],
        help="Specific archive to load. Can be repeated. Defaults to all images-dir/*.tar.gz.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    archives = [Path(item).resolve() for item in args.archive]
    if not archives:
        images_dir = Path(args.images_dir).resolve()
        archives = sorted(images_dir.glob("*.tar.gz"))

    if not archives:
        print("no image archives found", file=sys.stderr)
        return 1

    try:
        for archive in archives:
            if not archive.exists():
                raise RuntimeError(f"archive not found: {archive}")
            load_archive(archive)
    except (RuntimeError, subprocess.CalledProcessError, OSError) as exc:
        print(f"failed: {exc}", file=sys.stderr)
        return 1

    print("Docker image archives loaded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
