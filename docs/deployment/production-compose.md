# Production Compose

`docker-compose.prod.yml` is the production template for a self-contained `/opt/meet37` deployment. It runs the loaded backend/frontend images plus coturn and Caddy from the same compose project.

## Layout

Expected server directory:

```text
/opt/meet37/
  .env
  .env.example
  docker-compose.prod.yml
  images/
    meet37-images-<tag>.tar.gz
  caddy/
    Caddyfile
    certs/
      fullchain.pem
      privkey.pem
  data/
    backend/
  scripts/
    prepare_server.py
```

The repository includes this template under `deploy/`.
`scripts/prepare_server.py` creates `.env` from `.env.example` when `.env` does not exist.

## Required `.env` Values

Set these before starting production:

```text
PUBLIC_DOMAIN=meet.example.com
PUBLIC_ORIGIN=https://meet.example.com
ALLOWED_ORIGINS=https://meet.example.com
TURN_PUBLIC_IP=<server-public-ip>
NEXT_PUBLIC_TURN_PUBLIC_IP=<server-public-ip>
TURN_REALM=meet.example.com
DOCKER_IMAGE_TAG=<tag>
```

`scripts/prepare_server.py` replaces placeholder `ADMIN_PASSWORD`, `JWT_SECRET`, and `TURN_SECRET` values with generated secrets.

## Services

- `caddy` publishes `80/tcp` and `443/tcp`, reads `./caddy/Caddyfile`, and mounts certificates from `./caddy/certs`.
- `frontend` is exposed only inside Docker and is reached by Caddy.
- `backend` is exposed only inside Docker for HTTP, but publishes the SFU UDP media range.
- `coturn` publishes TURN TCP/UDP and the relay TCP/UDP range.

No external proxy Docker network is required.

## Offline Images

Build the bundle locally:

```bash
python scripts/build_images.py --version <tag>
```

The default output directory is `deploy/images`.

On the server:

```bash
cd /opt/meet37
docker load -i images/meet37-images-<tag>.tar.gz
python3 scripts/prepare_server.py --public-origin https://meet.example.com --public-ip <server-public-ip>
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

## Media Ports

Production compose publishes:

- `80/tcp`
- `443/tcp`
- `TURN_HOST_PORT:TURN_PORT/udp`
- `TURN_HOST_PORT:TURN_PORT/tcp`
- `TURN_RELAY_PORT_MIN-TURN_RELAY_PORT_MAX` for UDP and TCP
- `WEBRTC_UDP_HOST_PORT_MIN-WEBRTC_UDP_HOST_PORT_MAX/udp`

These ports must also be allowed by the server firewall. `prepare_server.py` applies the firewall rules when ufw or firewalld is active.

## Validation

```bash
docker compose --env-file .env -f docker-compose.prod.yml config -q
docker compose --env-file .env -f docker-compose.prod.yml ps
curl -I https://meet.example.com
curl -i https://meet.example.com/api/settings
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=100 caddy
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=100 frontend
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=100 backend
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=100 coturn
```
