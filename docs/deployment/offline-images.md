# Offline Images

meet37 uses one image build script that builds and packages every required Docker image into a single compressed `.tar.gz` archive.

## Build

From the repository root:

```bash
python scripts/build_images.py --version <tag>
```

The archive is written to `deploy/images` by default:

```text
deploy/images/meet37-images-<tag>.tar.gz
```

The bundle includes:

- `${DOCKER_BACKEND_IMAGE}:${DOCKER_IMAGE_TAG}`
- `${DOCKER_FRONTEND_IMAGE}:${DOCKER_IMAGE_TAG}`
- `${COTURN_IMAGE}`
- `${CADDY_IMAGE}`
- `DOCKER_EXTRA_IMAGES`, if configured

## Transfer

Copy the whole deploy directory to the server:

```bash
rsync -a deploy/ root@server:/opt/meet37/
```

The copied directory contains `.env.example`. The real `/opt/meet37/.env` is created by `scripts/prepare_server.py` and should not be committed.

Then put your TLS files here:

```text
/opt/meet37/caddy/certs/fullchain.pem
/opt/meet37/caddy/certs/privkey.pem
```

## Load And Start

On the server:

```bash
cd /opt/meet37
docker load -i images/meet37-images-<tag>.tar.gz
python3 scripts/prepare_server.py \
  --public-origin https://meet.example.com \
  --public-ip <server-public-ip>
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

Confirm:

```bash
docker images | grep -E 'meet37|coturn|caddy'
docker compose --env-file .env -f docker-compose.prod.yml ps
```

## Useful Options

```bash
python scripts/build_images.py --version 2026-07-03-1
python scripts/build_images.py --output-dir deploy/images
python scripts/build_images.py --backend-image meet37-backend --frontend-image meet37-frontend
python scripts/build_images.py --coturn-image coturn/coturn:latest
python scripts/build_images.py --caddy-image caddy:2-alpine
python scripts/build_images.py --extra-image prom/node-exporter:latest
```

Frontend build arg overrides:

```bash
python scripts/build_images.py \
  --api-base-url browser-origin \
  --ws-url browser-origin \
  --turn-public-ip <server-public-ip> \
  --backend-internal-url http://backend:8080 \
  --frontend-port 3000
```
