# meet37

Server-optimized real-time meeting platform focused on minimal backend load.

## Current implementation status

- Backend (Rust + Axum)
- `POST /rooms` create room token
- `GET /rooms/:token` validate room token
- `POST /rooms/:token/join` generate LiveKit participant token
- `POST /files/upload-url` generate presigned S3 upload/download URLs
- Redis fixed-window rate limiting for create/join/upload-url
- PostgreSQL room storage + Redis room existence cache

- Frontend (React + Vite)
- Landing flow for room creation/join
- Room connection with LiveKit token flow
- Video grid + mic/camera bootstrap
- Chat over LiveKit data channel
- Yjs whiteboard sync over LiveKit data channel
- Direct S3 file upload and link broadcast

- Local infrastructure
- Docker Compose for PostgreSQL, Redis, MinIO, LiveKit, backend

## Quick start

1. Start infrastructure

```bash
docker compose up -d postgres redis minio minio-init livekit
```

2. Run backend

```bash
cd backend
cp .env.example .env
cargo run
```

3. Run frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Monorepo layout

- `backend/`: Rust + Axum API
- `frontend/`: React + Vite client
- `infra/livekit.yaml`: local LiveKit config
- `docker-compose.yml`: local stack