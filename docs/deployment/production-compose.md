# Production Compose

`docker-compose.prod.yml` is the recommended production deployment template when images are already built or pulled from a registry. On a server it is commonly copied to `/opt/meet37/docker-compose.yml` so normal `docker compose` commands can be used from the deployment directory.

## Layout

Expected server directory:

```text
/opt/meet37/
  docker-compose.yml
  .env
  data/
    backend/
  scripts/
    check_server_requirements.py
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
- Publishes the backend WebRTC UDP media range on the host.
- Joins only the internal app network.
- Exposes `/health` for Docker healthcheck.

The backend HTTP port is not published by production compose. It is reached by the frontend through the internal Docker network.

## Coturn Service

The coturn service:

- Uses `${COTURN_IMAGE}`.
- Publishes `TURN_HOST_PORT` for UDP and TCP.
- Publishes `TURN_RELAY_PORT_MIN` through `TURN_RELAY_PORT_MAX` as UDP and TCP.
- Uses `TURN_PUBLIC_IP`, `TURN_REALM`, and `TURN_SECRET` to issue time-limited TURN credentials through the backend.
- Joins only the internal app network.

The coturn relay ports are separate from the backend WebRTC UDP range. Both ranges must be published and allowed by the server firewall.

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
- `TURN_RELAY_PORT_MIN-TURN_RELAY_PORT_MAX:TURN_RELAY_PORT_MIN-TURN_RELAY_PORT_MAX/udp`
- `TURN_RELAY_PORT_MIN-TURN_RELAY_PORT_MAX:TURN_RELAY_PORT_MIN-TURN_RELAY_PORT_MAX/tcp`
- `WEBRTC_UDP_HOST_PORT_MIN-WEBRTC_UDP_HOST_PORT_MAX:WEBRTC_UDP_PORT_MIN-WEBRTC_UDP_PORT_MAX/udp`

These ports must also be allowed by the server firewall.

## Server Requirement Check

Run:

```bash
python3 scripts/check_server_requirements.py --compose-file docker-compose.yml --fix
```

Use `--public-origin` and `--public-ip` when you want to force exact values:

```bash
python3 scripts/check_server_requirements.py \
  --compose-file docker-compose.yml \
  --public-origin https://meet.example.com \
  --public-ip 203.0.113.10 \
  --fix
```

## Start

```bash
docker compose up -d
docker compose ps
```

## Smoke Test

```bash
curl -I https://meet.example.com
curl -i https://meet.example.com/api/settings
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 coturn
```

Then test in two browsers:

1. Create a room.
2. Join from a second browser/device.
3. Toggle microphone.
4. Toggle camera.
5. Toggle screen share where supported.
6. Send a small file.
7. Confirm chat history and file metadata persist after refresh.

Validate TURN with time-limited credentials when diagnosing media failures:

```bash
SECRET="$(grep '^TURN_SECRET=' .env | cut -d= -f2-)"
COTURN_CONTAINER_NAME="$(grep '^COTURN_CONTAINER_NAME=' .env | cut -d= -f2-)"
TURN_PUBLIC_IP="$(grep '^TURN_PUBLIC_IP=' .env | cut -d= -f2-)"
TURN_PORT="$(grep '^TURN_PORT=' .env | cut -d= -f2-)"
USERNAME="$(($(date +%s) + 3600)):test"
PASSWORD="$(printf '%s' "$USERNAME" | openssl dgst -binary -sha1 -hmac "$SECRET" | openssl base64)"
docker exec "$COTURN_CONTAINER_NAME" turnutils_uclient \
  -u "$USERNAME" \
  -w "$PASSWORD" \
  -y "$TURN_PUBLIC_IP" \
  -p "$TURN_PORT" \
  "$TURN_PUBLIC_IP"
```

## Rollback

1. Set `DOCKER_IMAGE_TAG` back to the previous working tag.
2. Run `docker compose up -d`.
3. Check health and logs.
4. Keep the data directory unchanged unless the rollback specifically requires database restore.
