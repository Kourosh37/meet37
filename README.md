# meet37

meet37 is a browser-based meeting platform for real-time rooms, audio, camera, screen sharing, chat, and file transfer. The project is built as a full-stack application with a Go backend, a Next.js frontend, WebRTC media flows, Docker deployment support, and CI/CD automation.

This README is intentionally short. The complete project documentation lives in [docs](docs/README.md).

## What It Includes

- Public and private meeting rooms.
- Meet-style room IDs and landing-page room joining.
- Real-time camera, microphone, and screen sharing.
- WebRTC peer/media coordination with server-side signaling.
- Host and admin moderation for media, chat, reactions, kicking, and rejoin blocks.
- Chat and file transfer inside rooms.
- Responsive desktop and mobile meeting UI.
- Docker and production deployment support.
- Offline image build tooling.
- Server requirement checks for media ports and runtime dependencies.
- GitHub Actions CI/CD for the `production` branch.

## Documentation

- [Documentation Index](docs/README.md)
- [Documentation Plan](docs/documentation-plan.md)
- [Project Overview](docs/product/overview.md)
- [Feature Catalog](docs/product/features.md)
- [User Flows](docs/product/user-flows.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Frontend Architecture](docs/architecture/frontend.md)
- [Backend Architecture](docs/architecture/backend.md)
- [WebRTC And Media](docs/architecture/webrtc-media.md)
- [File Transfer](docs/architecture/file-transfer.md)
- [Local Development](docs/setup/local-development.md)
- [Configuration](docs/setup/configuration.md)
- [Environment Variables](docs/setup/environment-variables.md)
- [Docker Deployment](docs/deployment/docker.md)
- [Production Compose](docs/deployment/production-compose.md)
- [Caddy Reverse Proxy](docs/deployment/caddy.md)
- [Offline Images](docs/deployment/offline-images.md)
- [CI/CD](docs/deployment/ci-cd.md)
- [Operations Runbook](docs/operations/runbook.md)
- [Troubleshooting](docs/operations/troubleshooting.md)
- [Testing Strategy](docs/testing/strategy.md)
- [Security](docs/security/overview.md)
- [API Reference](docs/reference/api.md)
- [WebSocket Signaling](docs/reference/websocket-signaling.md)
- [Contribution Guide](docs/contributing.md)

## Quick Start

Create an environment file from the example:

```bash
cp .env.example .env
```

Run the application with Docker:

```bash
docker compose up --build
```

For production image-based deployment, use:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Before deploying media features on a server, validate ports and runtime requirements:

```bash
python scripts/check_server_requirements.py --fix
```

## Repository Layout

```text
backend/      Go backend, HTTP APIs, signaling, media coordination
frontend/     Next.js frontend, meeting UI, WebRTC client code
scripts/      Build, image, and server validation scripts
docs/         Central project documentation
.github/      GitHub Actions workflows
```

## Production Notes

The CI/CD pipeline is configured around the `production` branch. Production deployment should use the variables in `.env` and `.env.example`; avoid hard-coded domains, ports, image tags, and network names in application code.

For server setup, start from [Production Compose](docs/deployment/production-compose.md), [Caddy Reverse Proxy](docs/deployment/caddy.md), and [Operations Runbook](docs/operations/runbook.md).
