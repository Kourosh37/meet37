# meet37

Server-optimized real-time meeting platform focused on minimal backend load.

## Monorepo Layout

- `backend/`: Rust + Axum API for room lifecycle, LiveKit token generation, and S3 presigned URLs.
- `frontend/`: React + Vite client for room UI, media, chat, whiteboard sync, and file sharing.
- `docker-compose.yml`: Local dev stack (PostgreSQL, Redis, LiveKit, MinIO, backend).

## Architecture Principles

- Backend handles only stateless, lightweight REST operations.
- Media, chat, and whiteboard sync run over LiveKit/WebRTC.
- File bytes flow directly between browser and S3-compatible storage.
- Redis is used for cache and rate limiting; PostgreSQL stores tiny room metadata.