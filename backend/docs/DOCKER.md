# Docker And Deployment

## Docker Files

- `Dockerfile`: multi-stage build for Go + SQLite CGO.
- `docker-compose.yml`: local single-service deployment.
- `.dockerignore`: excludes local secrets, runtime data, and build artifacts.

## Build Image

```bash
cd backend
docker build -t meet-backend .
```

## Run Image Directly

```bash
docker run --rm -p 8080:8080 \
  -v meet-data:/data \
  --env-file .env \
  meet-backend
```

The image includes a Docker `HEALTHCHECK` that calls:

```text
GET http://localhost:${PORT:-8080}/health
```

## Run With Docker Compose

```bash
cd backend
cp .env.example .env
docker compose up --build
```

Service ports:

- `8080:8080` for HTTP and WebSocket.
- `3478:3478/udp` advertised for TURN-style fallback.
- `3478:3478/tcp` advertised for TURN-style fallback.

Persistent volume:

```yaml
volumes:
  - meet-data:/data
```

SQLite database path:

```env
DB_PATH=/data/meet.db
```

## Production Environment

Set strong values:

```env
ADMIN_PASSWORD=<strong password>
JWT_SECRET=<long random secret>
TURN_SECRET=<long random secret>
ALLOWED_ORIGINS=https://your-frontend.example.com
TURN_PUBLIC_IP=<public server ip or hostname>
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=30
RATE_LIMIT_RPS=20
RATE_LIMIT_BURST=60
REDIS_URL=redis://redis:6379/0
```

## Reverse Proxy

If serving behind Nginx/Caddy/Traefik:

- Forward normal HTTP requests.
- Support WebSocket upgrade for `/ws`.
- Preserve `Authorization` headers.
- Configure TLS at the proxy.

Nginx WebSocket essentials:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header Authorization $http_authorization;
```

## Health Check

Docker Compose uses:

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
```

Standalone containers also expose the same health check through Docker image metadata, so `docker inspect` reports `healthy` after startup.

## Data Backup

SQLite files live in the Docker volume. For backups, stop writes or snapshot the volume consistently.

Files to expect:

- `meet.db`
- `meet.db-wal`
- `meet.db-shm`

Because WAL mode is enabled, copy all three files when backing up a live database.

## Scaling Notes

The backend can share signaling and waiting-room commands through Redis by setting `REDIS_URL`. SFU media sessions are still process-local, so sticky routing by room remains recommended unless a dedicated SFU layer is introduced.
