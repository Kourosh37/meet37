#!/usr/bin/env python3
"""Validate meet37 environment files."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = ROOT / ".env"
DEFAULT_ENV_EXAMPLE = ROOT / ".env.example"

REQUIRED_KEYS = {
    "PORT",
    "BACKEND_HOST_PORT",
    "BACKEND_HEALTHCHECK_URL",
    "ENV",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "JWT_SECRET",
    "DEFAULT_APP_MODE",
    "TURN_PUBLIC_IP",
    "PUBLIC_IP_DISCOVERY_URLS",
    "TURN_PORT",
    "TURN_HOST_PORT",
    "TURN_RELAY_PORT_MIN",
    "TURN_RELAY_PORT_MAX",
    "TURN_REALM",
    "TURN_SECRET",
    "DB_PATH",
    "SFU_FALLBACK_THRESHOLD_KBPS",
    "SFU_AUTO_PEER_THRESHOLD",
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
    "WEBRTC_UDP_HOST_PORT_MIN",
    "WEBRTC_UDP_HOST_PORT_MAX",
    "NEXT_PUBLIC_API_BASE_URL",
    "FRONTEND_HOST_PORT",
    "FRONTEND_PORT",
    "FRONTEND_HEALTHCHECK_URL",
    "NEXT_PUBLIC_WS_URL",
    "NEXT_PUBLIC_TURN_PUBLIC_IP",
    "BACKEND_INTERNAL_URL",
    "DOCKER_IMAGE_OUTPUT_DIR",
}

PRODUCTION_KEYS = {
    "DOCKER_BACKEND_IMAGE",
    "DOCKER_FRONTEND_IMAGE",
    "DOCKER_IMAGE_TAG",
    "BACKEND_CONTAINER_NAME",
    "FRONTEND_CONTAINER_NAME",
    "COTURN_CONTAINER_NAME",
    "COTURN_IMAGE",
    "DOCKER_INTERNAL_NETWORK",
    "DOCKER_PROXY_NETWORK",
}

INTEGER_KEYS = {
    "PORT",
    "BACKEND_HOST_PORT",
    "TURN_PORT",
    "TURN_HOST_PORT",
    "TURN_RELAY_PORT_MIN",
    "TURN_RELAY_PORT_MAX",
    "SFU_FALLBACK_THRESHOLD_KBPS",
    "SFU_AUTO_PEER_THRESHOLD",
    "ACCESS_TOKEN_TTL_MINUTES",
    "REFRESH_TOKEN_TTL_DAYS",
    "RATE_LIMIT_RPS",
    "RATE_LIMIT_BURST",
    "MAX_BODY_BYTES",
    "WEBRTC_UDP_PORT_MIN",
    "WEBRTC_UDP_PORT_MAX",
    "WEBRTC_UDP_HOST_PORT_MIN",
    "WEBRTC_UDP_HOST_PORT_MAX",
    "FRONTEND_HOST_PORT",
    "FRONTEND_PORT",
}

INSECURE_VALUES = {
    "ADMIN_PASSWORD": {
        "change_me_strong_password",
        "changeme",
        "password",
        "admin",
    },
    "JWT_SECRET": {
        "replace_with_a_long_random_secret",
        "change-me-in-production",
    },
    "TURN_SECRET": {
        "another_random_secret_for_turn",
        "turnsecret",
    },
}


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


def is_url(value: str) -> bool:
    return value.startswith("http://") or value.startswith("https://")


def is_ws_url(value: str) -> bool:
    return value in {"browser-origin", ""} or value.startswith(("ws://", "wss://"))


def add_issue(issues: list[str], message: str) -> None:
    issues.append(f"ERROR: {message}")


def add_warning(warnings: list[str], message: str) -> None:
    warnings.append(f"WARNING: {message}")


def validate_values(
    values: dict[str, str],
    example_values: dict[str, str],
    *,
    production: bool,
) -> tuple[list[str], list[str]]:
    issues: list[str] = []
    warnings: list[str] = []

    required = set(REQUIRED_KEYS)
    if production:
        required.update(PRODUCTION_KEYS)

    for key in sorted(required):
        if key not in values:
            add_issue(issues, f"{key} is missing from .env")

    for key in sorted(set(example_values) - set(values)):
        if key in required:
            add_issue(issues, f"{key} exists in .env.example but not .env")

    for key in sorted(set(values) - set(example_values)):
        add_warning(warnings, f"{key} exists in .env but not .env.example")

    for key in INTEGER_KEYS:
        raw = values.get(key, "")
        if not raw:
            continue
        try:
            number = int(raw)
        except ValueError:
            add_issue(issues, f"{key} must be an integer")
            continue
        if "PORT" in key and (number < 1 or number > 65535):
            add_issue(issues, f"{key} is outside a valid port range")

    if values.get("DEFAULT_APP_MODE") not in {"public", "private"}:
        add_issue(issues, "DEFAULT_APP_MODE must be public or private")

    if values.get("ENV") not in {"production", "development", "local", "test"}:
        add_warning(warnings, "ENV is not one of production, development, local, test")

    try:
        udp_min = int(values.get("WEBRTC_UDP_PORT_MIN", "0"))
        udp_max = int(values.get("WEBRTC_UDP_PORT_MAX", "0"))
        host_min = int(values.get("WEBRTC_UDP_HOST_PORT_MIN", "0"))
        host_max = int(values.get("WEBRTC_UDP_HOST_PORT_MAX", "0"))
        if udp_min > udp_max:
            add_issue(issues, "WEBRTC_UDP_PORT_MIN must be <= WEBRTC_UDP_PORT_MAX")
        if host_min > host_max:
            add_issue(
                issues,
                "WEBRTC_UDP_HOST_PORT_MIN must be <= WEBRTC_UDP_HOST_PORT_MAX",
            )
        if (udp_max - udp_min) != (host_max - host_min):
            add_issue(issues, "internal and host WebRTC UDP ranges must be same size")
        turn_relay_min = int(values.get("TURN_RELAY_PORT_MIN", "0"))
        turn_relay_max = int(values.get("TURN_RELAY_PORT_MAX", "0"))
        if turn_relay_min > turn_relay_max:
            add_issue(issues, "TURN_RELAY_PORT_MIN must be <= TURN_RELAY_PORT_MAX")
    except ValueError:
        pass

    if values.get("NEXT_PUBLIC_API_BASE_URL") != "browser-origin" and not is_url(
        values.get("NEXT_PUBLIC_API_BASE_URL", "")
    ):
        add_issue(
            issues,
            "NEXT_PUBLIC_API_BASE_URL must be browser-origin or an http(s) URL",
        )

    if not is_ws_url(values.get("NEXT_PUBLIC_WS_URL", "")):
        add_issue(issues, "NEXT_PUBLIC_WS_URL must be browser-origin or a ws(s) URL")

    public_origin = values.get("PUBLIC_ORIGIN", "")
    allowed_origins = [
        item.strip() for item in values.get("ALLOWED_ORIGINS", "").split(",") if item
    ]
    if public_origin and public_origin not in allowed_origins:
        add_warning(warnings, "PUBLIC_ORIGIN is not included in ALLOWED_ORIGINS")
    if production and "*" in allowed_origins:
        add_issue(issues, "ALLOWED_ORIGINS must not be * in production")

    if production:
        for key, bad_values in INSECURE_VALUES.items():
            if values.get(key) in bad_values:
                add_issue(issues, f"{key} still uses a default/insecure value")
        if values.get("PUBLIC_ORIGIN", "").startswith("http://"):
            add_issue(issues, "PUBLIC_ORIGIN should use https:// in production")
        if values.get("TURN_PUBLIC_IP") in {"127.0.0.1", "localhost", ""}:
            add_warning(
                warnings,
                "TURN_PUBLIC_IP is local; production media may fail outside localhost",
            )
        if values.get("NEXT_PUBLIC_TURN_PUBLIC_IP") in {"127.0.0.1", "localhost", ""}:
            add_warning(
                warnings,
                "NEXT_PUBLIC_TURN_PUBLIC_IP is local; browser media may fail in production",
            )

    image = values.get("DOCKER_IMAGE_TAG", "")
    if image and not re.match(r"^[A-Za-z0-9_.-]+$", image):
        add_issue(issues, "DOCKER_IMAGE_TAG contains invalid characters")

    return issues, warnings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate meet37 .env files.")
    parser.add_argument("--env-file", default=str(DEFAULT_ENV_FILE))
    parser.add_argument("--env-example", default=str(DEFAULT_ENV_EXAMPLE))
    parser.add_argument(
        "--production",
        action="store_true",
        help="Fail on values that are unsafe for production.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as failures.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env_file = Path(args.env_file)
    env_example = Path(args.env_example)

    if not env_example.exists():
        print(f"ERROR: env example not found: {env_example}", file=sys.stderr)
        return 1
    if not env_file.exists():
        print(f"ERROR: env file not found: {env_file}", file=sys.stderr)
        return 1

    values = parse_env_file(env_file)
    example_values = parse_env_file(env_example)
    production = args.production
    issues, warnings = validate_values(values, example_values, production=production)

    for warning in warnings:
        print(warning)
    for issue in issues:
        print(issue)

    if issues or (args.strict and warnings):
        print("Environment validation failed.", file=sys.stderr)
        return 1

    print("Environment validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
