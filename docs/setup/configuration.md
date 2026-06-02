# Configuration

meet37 is configured through environment variables. `.env.example` is the documented template and `.env` is the local or server-specific runtime file.

## Rules

- Do not commit `.env`.
- Keep every deploy-specific value in `.env`.
- Keep `.env.example` complete and documented.
- Do not hard-code domains, public IPs, image tags, container names, or port ranges in application code.
- Use `browser-origin` for public frontend API and WebSocket URLs when running behind a reverse proxy.

## Backend Configuration

The backend reads variables in `backend/internal/config/config.go`. Important groups:

- Runtime: `PORT`, `ENV`.
- Admin: `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
- Auth: `JWT_SECRET`, `ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`.
- App mode: `DEFAULT_APP_MODE`.
- Database: `DB_PATH`.
- CORS: `ALLOWED_ORIGINS`.
- Request limits: `RATE_LIMIT_RPS`, `RATE_LIMIT_BURST`, `MAX_BODY_BYTES`.
- Media: `TURN_PUBLIC_IP`, `TURN_PORT`, `TURN_SECRET`, `WEBRTC_UDP_PORT_MIN`, `WEBRTC_UDP_PORT_MAX`, `SFU_FALLBACK_THRESHOLD_KBPS`.
- Optional cluster: `REDIS_URL`, `INSTANCE_ID`.
- Recording: `SFU_RECORDING_ENABLED`, `SFU_RECORDING_PATH`.

## Frontend Configuration

The frontend public runtime config is defined in `frontend/src/lib/env.ts`.

Supported public variables:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_WS_URL`
- `NEXT_PUBLIC_TURN_PUBLIC_IP`

`browser-origin` is the recommended value for `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_URL` in reverse-proxy deployments.

## Next.js Server Configuration

`frontend/next.config.mjs` requires:

```text
BACKEND_INTERNAL_URL
```

It rewrites `/api/:path*` and `/ws` to the backend. In Docker Compose, the value should normally be:

```text
BACKEND_INTERNAL_URL=http://backend:8080
```

## Docker Configuration

`docker-compose.yml` builds images locally and publishes frontend/backend/media ports.

`docker-compose.prod.yml` runs prebuilt images and expects:

- `DOCKER_BACKEND_IMAGE`
- `DOCKER_FRONTEND_IMAGE`
- `DOCKER_IMAGE_TAG`
- `BACKEND_CONTAINER_NAME`
- `FRONTEND_CONTAINER_NAME`
- `DOCKER_INTERNAL_NETWORK`
- `DOCKER_PROXY_NETWORK`

## Secrets

Production must change:

- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `TURN_SECRET`

Generate long random values:

```bash
openssl rand -base64 48
```

## Public Origin

For a production domain such as `https://meet.example.com`:

```text
PUBLIC_DOMAIN=meet.example.com
PUBLIC_ORIGIN=https://meet.example.com
ALLOWED_ORIGINS=https://meet.example.com
NEXT_PUBLIC_API_BASE_URL=browser-origin
NEXT_PUBLIC_WS_URL=browser-origin
```

## Media Ports

For production, keep internal and host media port ranges aligned unless there is a specific reason to remap:

```text
TURN_PORT=3478
TURN_HOST_PORT=3478
WEBRTC_UDP_PORT_MIN=40000
WEBRTC_UDP_PORT_MAX=40100
WEBRTC_UDP_HOST_PORT_MIN=40000
WEBRTC_UDP_HOST_PORT_MAX=40100
```
