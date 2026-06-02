#!/usr/bin/env python3
"""Run the meet37 release validation pipeline."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str], *, cwd: Path = ROOT, env: dict[str, str] | None = None) -> None:
    print("+ " + " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True, env=env)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate and package a meet37 release.")
    parser.add_argument("--version", default="")
    parser.add_argument("--skip-tests", action="store_true")
    parser.add_argument("--skip-frontend-build", action="store_true")
    parser.add_argument("--skip-images", action="store_true")
    parser.add_argument("--production-env", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        env_cmd = ["python", "scripts/validate_env.py"]
        if args.production_env:
            env_cmd.append("--production")
        run(env_cmd)

        if not args.skip_tests:
            run(["go", "test", "./..."], cwd=ROOT / "backend")
            run(["pnpm", "typecheck"], cwd=ROOT / "frontend")
            run(["pnpm", "lint"], cwd=ROOT / "frontend")
            run(["pnpm", "test"], cwd=ROOT / "frontend")

        if not args.skip_frontend_build:
            run(["pnpm", "build"], cwd=ROOT / "frontend")

        run(["docker", "compose", "--env-file", ".env.example", "config", "-q"])
        compose_env = {**os.environ, "DOCKER_IMAGE_TAG": args.version or "ci"}
        run(
            [
                "docker",
                "compose",
                "--env-file",
                ".env.example",
                "-f",
                "docker-compose.prod.yml",
                "config",
                "-q",
            ],
            env=compose_env,
        )

        if not args.skip_images:
            image_cmd = ["python", "scripts/build_docker_images.py"]
            if args.version:
                image_cmd.extend(["--version", args.version])
            run(image_cmd)

        print("Release validation completed.")
        return 0
    except subprocess.CalledProcessError as exc:
        print(f"release failed with exit code {exc.returncode}", file=sys.stderr)
        return exc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
