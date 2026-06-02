# Production Compose

`docker-compose.prod.yml` is the recommended production deployment file when images are already built or pulled from a registry.

## Layout

Expected server directory:

```text
/opt/meet37/
  docker-compose.prod.yml
  .env
  data/
    backend/
```

If using offline image archives, also keep:

```text
images/
```

## Required `.env` Values

Production compose requires image and network values:

```text
DOCKER_BACKEND_IMAGE=meet37-backend
DOCKER_FRONTEND_IMAGE=meet37-frontend
DOCKER_IMAGE_TAG=<tag>
BACKEND_CONTAINER_NAME=meet37-backend
FRONTEND_CONTAINER_NAME=meet37
DOCKER_INTERNAL_NETWORK=meet37_internal
DOCKER_PROXY_NETWORK=proxy
```

It also requires all runtime values described in [Environment Variables](../setup/environment-variables.md).

## Backend Service

The backend service:

- Uses `${DOCKER_BACKEND_IMAGE}:${DOCKER_IMAGE_TAG}`.
- Loads `.env`.
- Mounts `./data/backend:/data`.
- Publishes TURN/media ports on the host.
- Joins only the internal app network.
- Exposes `/health` for Docker healthcheck.

The backend HTTP port is not published by production compose. It is reached by the frontend through the internal Docker network.

## Frontend Service

The frontend service:

- Uses `${DOCKER_FRONTEND_IMAGE}:${DOCKER_IMAGE_TAG}`.
- Receives Next.js runtime variables.
- Depends on a healthy backend.
- Joins both internal and proxy networks.
- Is intended to be reached by Caddy or another reverse proxy.

## Reverse Proxy Network

`DOCKER_PROXY_NETWORK` is external. It must exist before compose starts unless a server setup script creates it.

Create it manually:

```bash
docker network create proxy
```

## Media Ports

Production compose publishes:

- `TURN_HOST_PORT:TURN_PORT/udp`
- `TURN_HOST_PORT:TURN_PORT/tcp`
- `WEBRTC_UDP_HOST_PORT_MIN-WEBRTC_UDP_HOST_PORT_MAX:WEBRTC_UDP_PORT_MIN-WEBRTC_UDP_PORT_MAX/udp`

These ports must also be allowed by the server firewall.

## Server Requirement Check

Run:

```bash
python3 scripts/check_server_requirements.py --compose-file docker-compose.prod.yml --fix
```

Use `--public-origin` and `--public-ip` when you want to force exact values:

```bash
python3 scripts/check_server_requirements.py \
  --compose-file docker-compose.prod.yml \
  --public-origin https://meet.example.com \
  --public-ip 203.0.113.10 \
  --fix
```

## Start

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

## Smoke Test

```bash
curl -I https://meet.example.com
curl -i https://meet.example.com/api/settings
docker compose -f docker-compose.prod.yml logs --tail=100 backend
docker compose -f docker-compose.prod.yml logs --tail=100 frontend
```

Then test in two browsers:

1. Create a room.
2. Join from a second browser/device.
3. Toggle microphone.
4. Toggle camera.
5. Toggle screen share where supported.
6. Send a small file.
7. Confirm chat history and file metadata persist after refresh.

## Rollback

1. Set `DOCKER_IMAGE_TAG` back to the previous working tag.
2. Run `docker compose -f docker-compose.prod.yml up -d`.
3. Check health and logs.
4. Keep the data directory unchanged unless the rollback specifically requires database restore.
