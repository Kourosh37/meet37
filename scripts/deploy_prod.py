#!/usr/bin/env python3
"""Deploy meet37 with production Docker Compose."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = ROOT / ".env"
DEFAULT_COMPOSE_FILE = ROOT / "docker-compose.prod.yml"


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(command), flush=True)
    return subprocess.run(command, cwd=ROOT, check=check, text=True)


def compose_command() -> list[str]:
    result = subprocess.run(
        ["docker", "compose", "version"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return ["docker", "compose"]
    return ["docker-compose"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy meet37 production compose.")
    parser.add_argument("--env-file", default=str(DEFAULT_ENV_FILE))
    parser.add_argument("--compose-file", default=str(DEFAULT_COMPOSE_FILE))
    parser.add_argument("--base-url", default="")
    parser.add_argument("--skip-pull", action="store_true")
    parser.add_argument("--skip-smoke", action="store_true")
    parser.add_argument("--no-fix", action="store_true")
    parser.add_argument("--with-frontend-port", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    compose_file = str(Path(args.compose_file).resolve())
    env_file = str(Path(args.env_file).resolve())
    compose = compose_command()

    try:
        run(["python", "scripts/validate_env.py", "--env-file", env_file, "--production"])
        check_cmd = [
            "python",
            "scripts/check_server_requirements.py",
            "--env-file",
            env_file,
            "--compose-file",
            compose_file,
        ]
        if args.with_frontend_port:
            check_cmd.append("--include-frontend-port")
        if not args.no_fix:
            check_cmd.append("--restart")
        run(check_cmd)
        run([*compose, "-f", compose_file, "config", "-q"])
        if not args.skip_pull:
            run([*compose, "-f", compose_file, "pull"])
        run([*compose, "-f", compose_file, "up", "-d", "--remove-orphans"])
        run([*compose, "-f", compose_file, "ps"])
        if not args.skip_smoke:
            smoke = ["python", "scripts/smoke_test.py", "--compose-file", compose_file]
            if args.base_url:
                smoke.extend(["--base-url", args.base_url])
            run(smoke)
        return 0
    except subprocess.CalledProcessError as exc:
        print(f"deployment failed with exit code {exc.returncode}", file=sys.stderr)
        run([*compose, "-f", compose_file, "logs", "--tail=120"], check=False)
        return exc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
