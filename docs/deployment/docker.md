# Docker Deployment

meet37 provides two Docker Compose files:

- `docker-compose.yml` for local/source builds.
- `docker-compose.prod.yml` for production image-based deployment.

## Development Compose

`docker-compose.yml` builds both services from local Dockerfiles.

Services:

- `caddy`
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

Public traffic goes through the `caddy` service on ports `80` and `443`.

Run:

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

Validate:

```bash
DOCKER_IMAGE_TAG=<tag> docker compose --env-file .env -f docker-compose.prod.yml config -q
```

## Image Archives

Build and export images:

```bash
python scripts/build_images.py
```

The script reads `.env.example` and `.env`, builds backend/frontend images, pulls coturn/Caddy runtime images, and writes one `.tar.gz` archive into `DOCKER_IMAGE_OUTPUT_DIR`, which defaults to `deploy/images`.

Load an archive on a server:

```bash
docker load -i images/meet37-images-<tag>.tar.gz
```

## Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f coturn
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f coturn
docker compose -f docker-compose.prod.yml logs -f caddy
```

## Health

Backend:

```bash
curl -i http://localhost:8080/health
```

Through Caddy:

```bash
curl -i https://meet.example.com/api/settings
```

## Upgrade

1. Build or pull new images.
2. Update `DOCKER_IMAGE_TAG` in `.env`.
3. Validate compose config.
4. Run `docker compose -f docker-compose.prod.yml up -d --remove-orphans`.
5. Check health, logs, room creation, room join, WebSocket, and media.
