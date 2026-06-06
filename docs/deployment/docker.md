# Docker Deployment

meet37 provides two Docker Compose files:

- `docker-compose.yml` for local/source builds.
- `docker-compose.prod.yml` for production image-based deployment.

## Development Compose

`docker-compose.yml` builds both services from local Dockerfiles.

Services:

- `backend`
- `coturn`
- `frontend`

Volumes:

- `meet-data:/data`

Published ports:

- `BACKEND_HOST_PORT:PORT`
- `FRONTEND_HOST_PORT:FRONTEND_PORT`
- `TURN_HOST_PORT:TURN_PORT/udp`
- `TURN_HOST_PORT:TURN_PORT/tcp`
- `TURN_RELAY_PORT_MIN-TURN_RELAY_PORT_MAX/udp`
- `TURN_RELAY_PORT_MIN-TURN_RELAY_PORT_MAX/tcp`
- `WEBRTC_UDP_HOST_PORT_MIN-WEBRTC_UDP_HOST_PORT_MAX:WEBRTC_UDP_PORT_MIN-WEBRTC_UDP_PORT_MAX/udp`

Run:

```bash
cp .env.example .env
docker compose up --build
```

Validate:

```bash
docker compose --env-file .env config -q
```

## Production Compose

`docker-compose.prod.yml` runs prebuilt images and does not build from source.

Services:

- `backend`
- `coturn`
- `frontend`

Data:

- `./data/backend:/data`

Networks:

- Internal application bridge network.
- External reverse-proxy network, usually `proxy`.

Run:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Validate:

```bash
DOCKER_IMAGE_TAG=<tag> docker compose --env-file .env -f docker-compose.prod.yml config -q
```

## Image Archives

Build and export images:

```bash
python scripts/build_docker_images.py
```

The script reads `.env.example` and `.env`, builds backend/frontend images, and writes `.tar.gz` archives into `DOCKER_IMAGE_OUTPUT_DIR`, which defaults to `dist`.

Load an archive on a server:

```bash
gzip -dc dist/meet37-backend_<tag>.tar.gz | docker load
gzip -dc dist/meet37-frontend_<tag>.tar.gz | docker load
```

## Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f coturn
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f coturn
```

## Health

Backend:

```bash
curl -i http://localhost:8080/health
```

Through frontend/reverse proxy:

```bash
curl -i https://meet.example.com/api/settings
```

## Upgrade

1. Build or pull new images.
2. Update `DOCKER_IMAGE_TAG` in `.env`.
3. Validate compose config.
4. Run `docker compose -f docker-compose.prod.yml up -d --remove-orphans`.
5. Check health, logs, room creation, room join, WebSocket, and media.
