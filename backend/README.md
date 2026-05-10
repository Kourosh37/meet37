# backend

Rust + Axum API for meet37.

## Endpoints

- `POST /rooms` -> create room token
- `GET /rooms/:token` -> check room existence
- `POST /rooms/:token/join` -> issue LiveKit access token
- `POST /files/upload-url` -> issue presigned S3 upload/download URLs
- `GET /health` -> health check

## Local run

1. Copy `.env.example` to `.env` and adjust values.
2. Start dependencies with Docker Compose:
   - `docker compose up -d postgres redis minio minio-init livekit`
3. Run backend:
   - `cargo run`