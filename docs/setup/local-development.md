# Local Development

This guide explains how to run meet37 locally for development and validation.

## Requirements

- Docker and Docker Compose.
- Go version from `backend/go.mod`.
- Node.js 22 for the frontend.
- pnpm version from `frontend/package.json`.
- Python 3 for scripts.

Docker-only development does not require installing Go or Node on the host.

## Environment Setup

Create a local environment file:

```bash
cp .env.example .env
```

For localhost Docker development, these values are usually correct:

```text
NEXT_PUBLIC_API_BASE_URL=browser-origin
NEXT_PUBLIC_WS_URL=browser-origin
NEXT_PUBLIC_TURN_PUBLIC_IP=127.0.0.1
TURN_PUBLIC_IP=127.0.0.1
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
BACKEND_INTERNAL_URL=http://backend:8080
```

Change `ADMIN_PASSWORD`, `JWT_SECRET`, and `TURN_SECRET` before sharing the environment with anyone else.

## Run With Docker Compose

```bash
docker compose up --build
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8080/health`
- Backend API through frontend rewrite: `http://localhost:3000/api/settings`

Stop the stack:

```bash
docker compose down
```

Remove the named data volume:

```bash
docker compose down -v
```

## Run Backend Directly

From `backend/`:

```bash
go mod download
go test ./...
go run ./cmd/server
```

The backend reads environment variables from the process. If running outside Docker, set at least:

```text
PORT=8080
DB_PATH=./data/meet.db
ALLOWED_ORIGINS=http://localhost:3000
JWT_SECRET=local-development-secret
TURN_SECRET=local-turn-secret
```

## Run Frontend Directly

From `frontend/`:

```bash
pnpm install
pnpm dev
```

For direct frontend development, set:

```text
BACKEND_INTERNAL_URL=http://localhost:8080
NEXT_PUBLIC_API_BASE_URL=browser-origin
NEXT_PUBLIC_WS_URL=browser-origin
NEXT_PUBLIC_TURN_PUBLIC_IP=127.0.0.1
```

## Validation Commands

Backend:

```bash
cd backend
go test ./...
go build -o /tmp/meet-server ./cmd/server
```

Frontend:

```bash
cd frontend
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Docker configuration:

```bash
docker compose --env-file .env config -q
DOCKER_IMAGE_TAG=local docker compose --env-file .env -f docker-compose.prod.yml config -q
```

Server requirements script:

```bash
python scripts/check_server_requirements.py
```

## Common Local Issues

If `/api/settings` returns 404 from the frontend origin, check `BACKEND_INTERNAL_URL` and Next.js rewrites.

If WebSocket cannot connect, check that `/ws` is routed to the backend and `NEXT_PUBLIC_WS_URL` resolves to the same origin.

If media works locally but not on a server, the issue is usually public IP, UDP port publishing, firewall, or browser secure-context requirements.
