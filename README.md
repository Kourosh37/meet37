# meet37

Server-optimized real-time meeting platform focused on minimal backend load.

## Stack (implemented)

- Backend: Rust + Axum + SQLx + Redis
- Frontend: React + Vite + LiveKit client + Yjs
- Infra: PostgreSQL, Redis, LiveKit, MinIO, Nginx gateway

## Docker Compose services

- `postgres`
- `redis`
- `minio` + `minio-init`
- `livekit`
- `backend`
- `frontend` (built static app served by Nginx)
- `nginx` (gateway/reverse-proxy, exposed on `:80`)

## Access points (local)

- App: `http://localhost`
- Backend API via gateway: `http://localhost/api`
- LiveKit WS via gateway: `ws://localhost/livekit`
- MinIO console: `http://localhost:9001`

## Local start

```bash
docker compose up -d --build
```