#!/usr/bin/env python3
"""Clean generated meet37 project artifacts."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DEFAULT_TARGETS = [
    "dist",
    "build",
    "tmp",
    ".tmp",
    "backend/bin",
    "backend/tmp",
    "backend/coverage",
    "backend/coverage.out",
    "frontend/.next",
    "frontend/out",
    "frontend/dist",
    "frontend/coverage",
    "frontend/playwright-report",
    "frontend/test-results",
    "frontend/tsconfig.tsbuildinfo",
    "frontend/.turbo",
    "frontend/.vercel",
    "frontend/.eslintcache",
    "frontend/.stylelintcache",
]

ALL_TARGETS = [
    "frontend/node_modules",
    "frontend/.pnpm-store",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
]


def iter_pycache() -> list[Path]:
    return [path for path in ROOT.rglob("__pycache__") if ".git" not in path.parts]


def safe_resolve(relative: str) -> Path:
    path = (ROOT / relative).resolve()
    if not str(path).startswith(str(ROOT)):
        raise RuntimeError(f"refusing to clean outside workspace: {path}")
    return path


def remove_path(path: Path, *, dry_run: bool) -> bool:
    if not path.exists():
        return False
    print(("would remove " if dry_run else "removing ") + str(path.relative_to(ROOT)))
    if dry_run:
        return True
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    else:
        path.unlink()
    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean generated project artifacts.")
    parser.add_argument("--all", action="store_true", help="Also remove dependencies caches.")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    targets = list(DEFAULT_TARGETS)
    if args.all:
        targets.extend(ALL_TARGETS)

    removed = 0
    for relative in targets:
        removed += int(remove_path(safe_resolve(relative), dry_run=args.dry_run))
    for path in iter_pycache():
        removed += int(remove_path(path, dry_run=args.dry_run))

    if removed == 0:
        print("Nothing to clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
