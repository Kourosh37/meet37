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

## Data Backup

SQLite files live in the Docker volume. For backups, stop writes or snapshot the volume consistently.

Files to expect:

- `meet.db`
- `meet.db-wal`
- `meet.db-shm`

Because WAL mode is enabled, copy all three files when backing up a live database.

## Scaling Notes

The current backend is single-instance for live meetings because active WebSocket state is in memory.

Before running multiple replicas, add one of:

- Sticky sessions by room ID and instance.
- Shared signaling state through Redis/NATS.
- A dedicated SFU/signaling layer.

