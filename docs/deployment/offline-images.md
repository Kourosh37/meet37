# Offline Images

meet37 includes scripts that build/package Docker images and save them as compressed `.tar.gz` archives. The archives can be copied to a server and loaded without pulling from a registry. The scripts do not generate a full Caddy config or deployment bundle.

## Build Archives

From the repository root:

```bash
python scripts/build_docker_images.py
```

The script:

- Requires Docker.
- Reads `.env.example` and `.env`.
- Uses `DOCKER_BACKEND_IMAGE` and `DOCKER_FRONTEND_IMAGE`.
- Pulls and archives `COTURN_IMAGE`.
- Pulls and archives comma-separated `DOCKER_EXTRA_IMAGES`, if set.
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
python scripts/build_docker_images.py --coturn-image coturn/coturn:latest
python scripts/build_docker_images.py --extra-image prom/node-exporter:latest
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
python3 scripts/load_docker_images.py --images-dir images
```

Confirm:

```bash
docker images | grep -E 'meet37|coturn'
```

## Run Loaded Images

Set `.env`:

```text
DOCKER_BACKEND_IMAGE=meet37-backend
DOCKER_FRONTEND_IMAGE=meet37-frontend
DOCKER_IMAGE_TAG=<tag>
COTURN_IMAGE=coturn/coturn:latest
```

Run:

```bash
python3 scripts/check_server_requirements.py --compose-file docker-compose.yml --public-origin https://meet.example.com
docker compose -f docker-compose.yml up -d
```

## Notes

- The production compose file must already exist on the server.
- If Caddy is a separate project, use `DOCKER_PROXY_NETWORK` for the shared external Docker network.
- `check_server_requirements.py` prepares env defaults, Docker networks, and firewall rules for HTTP, HTTPS, TURN, TURN relay TCP/UDP, and WebRTC/SFU UDP ranges.
- Media port counts are controlled by the min/max values in `.env`, such as `TURN_RELAY_PORT_MIN/MAX` and `WEBRTC_UDP_HOST_PORT_MIN/MAX`.
