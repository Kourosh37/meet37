# Offline Images

meet37 includes a script that builds Docker images and saves them as compressed `.tar.gz` archives. It does not generate a full offline bundle, compose file, env file, or Caddy config.

## Build Archives

From the repository root:

```bash
python scripts/build_docker_images.py
```

The script:

- Requires Docker.
- Reads `.env.example` and `.env`.
- Uses `DOCKER_BACKEND_IMAGE` and `DOCKER_FRONTEND_IMAGE`.
- Uses `DOCKER_IMAGE_TAG` or the current git short SHA.
- Builds `backend/Dockerfile`.
- Builds `frontend/Dockerfile`.
- Passes frontend build args from env.
- Saves archives to `DOCKER_IMAGE_OUTPUT_DIR`, default `dist`.

## Useful Options

```bash
python scripts/build_docker_images.py --version 2026-06-02-1
python scripts/build_docker_images.py --output-dir dist/images
python scripts/build_docker_images.py --backend-image meet37-backend --frontend-image meet37-frontend
```

Frontend build arg overrides:

```bash
python scripts/build_docker_images.py \
  --api-base-url browser-origin \
  --ws-url browser-origin \
  --turn-public-ip 203.0.113.10 \
  --backend-internal-url http://backend:8080 \
  --frontend-port 3000
```

## Transfer To Server

Copy archives to the server:

```bash
scp dist/*.tar.gz root@server:/opt/meet37/images/
```

## Load Images

On the server:

```bash
cd /opt/meet37
gzip -dc images/meet37-backend_<tag>.tar.gz | docker load
gzip -dc images/meet37-frontend_<tag>.tar.gz | docker load
```

Confirm:

```bash
docker images | grep meet37
```

## Run Loaded Images

Set `.env`:

```text
DOCKER_BACKEND_IMAGE=meet37-backend
DOCKER_FRONTEND_IMAGE=meet37-frontend
DOCKER_IMAGE_TAG=<tag>
```

Run:

```bash
docker compose -f docker-compose.prod.yml up -d
```

## Notes

- The archives contain only the application images.
- The production compose file must already exist on the server.
- The server must already have Docker and the reverse proxy network.
- Media ports still need firewall and Docker publishing even when images are loaded offline.
