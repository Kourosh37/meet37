# Environment Variables

This page is the operational reference for meet37 environment variables. The source of truth for defaults and comments is `.env.example`.

## Backend Runtime

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | Backend HTTP port inside the process/container. |
| `BACKEND_HOST_PORT` | Local compose | Backend HTTP port published on the Docker host in development compose. |
| `BACKEND_HEALTHCHECK_URL` | Docker | Healthcheck URL inside the backend container. |
| `ENV` | Yes | `production` or development-style runtime. Non-production uses console logs. |
| `DB_PATH` | Yes | SQLite database path. In Docker, use a path inside the mounted data volume. |

## Admin And Auth

| Variable | Required | Description |
| --- | --- | --- |
| `ADMIN_USERNAME` | Yes | Environment admin username. |
| `ADMIN_PASSWORD` | Yes | Environment admin password. Must be changed in production. |
| `JWT_SECRET` | Yes | Access token signing secret. Must be long and random. |
| `ACCESS_TOKEN_TTL_MINUTES` | Yes | Access token lifetime. |
| `REFRESH_TOKEN_TTL_DAYS` | Yes | Refresh token lifetime. |
| `DEFAULT_APP_MODE` | Yes | Initial app mode inserted into settings: `public` or `private`. |

## Request Security

| Variable | Required | Description |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | Yes | Comma-separated allowed browser origins for CORS and WebSocket flows. |
| `RATE_LIMIT_RPS` | Yes | Sustained per-IP request rate. |
| `RATE_LIMIT_BURST` | Yes | Per-IP burst allowance. |
| `MAX_BODY_BYTES` | Yes | Max HTTP request body size. |

## Public Origin

| Variable | Required | Description |
| --- | --- | --- |
| `PUBLIC_DOMAIN` | Recommended | Public domain without scheme. Used by scripts and deployment docs. |
| `PUBLIC_ORIGIN` | Recommended | Public HTTPS origin. |
| `PUBLIC_IP_DISCOVERY_URLS` | Script | Comma-separated URLs used by server requirement checks to detect public IPv4. |

## WebRTC And Media

| Variable | Required | Description |
| --- | --- | --- |
| `TURN_PUBLIC_IP` | Production | Public IP or host advertised for media/TURN-style credentials. |
| `TURN_PORT` | Yes | Internal advertised TURN/SFU port. |
| `TURN_HOST_PORT` | Docker | Host-published TURN/SFU port. |
| `TURN_RELAY_PORT_MIN` | Docker | Coturn relay UDP port range start. |
| `TURN_RELAY_PORT_MAX` | Docker | Coturn relay UDP port range end. |
| `TURN_REALM` | Production | TURN authentication realm, usually the public meeting domain. |
| `TURN_SECRET` | Yes | Secret for time-limited TURN-style credentials. |
| `SFU_FALLBACK_THRESHOLD_KBPS` | Yes | Low bitrate threshold for SFU fallback logic. |
| `SFU_AUTO_PEER_THRESHOLD` | Optional | Participant count at which a room is switched to SFU mode. Use `0` to disable automatic room-wide switching. |
| `SFU_RECORDING_ENABLED` | Optional | Enables diagnostic RTP recording. |
| `SFU_RECORDING_PATH` | Optional | Recording output directory. |
| `WEBRTC_UDP_PORT_MIN` | Yes | Internal UDP media port range start. |
| `WEBRTC_UDP_PORT_MAX` | Yes | Internal UDP media port range end. |
| `WEBRTC_UDP_HOST_PORT_MIN` | Docker | Host UDP media port range start. |
| `WEBRTC_UDP_HOST_PORT_MAX` | Docker | Host UDP media port range end. |

## Optional Cluster

| Variable | Required | Description |
| --- | --- | --- |
| `REDIS_URL` | Optional | Redis URL for multi-instance signaling coordination. Empty means single instance. |
| `INSTANCE_ID` | Optional | Instance identifier. Defaults to hostname. |

## Frontend Runtime

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Browser API base URL. Use `browser-origin` behind reverse proxies. |
| `NEXT_PUBLIC_WS_URL` | Yes | Browser WebSocket URL. Use `browser-origin` behind reverse proxies. |
| `NEXT_PUBLIC_TURN_PUBLIC_IP` | Yes | Public media host/IP exposed to browser bundle. |
| `FRONTEND_HOST_PORT` | Local compose | Frontend host port in development compose. |
| `FRONTEND_PORT` | Yes | Frontend internal port. |
| `FRONTEND_HEALTHCHECK_URL` | Docker | Healthcheck URL inside the frontend container. |
| `BACKEND_INTERNAL_URL` | Yes | Backend URL used by Next.js rewrites. |

## Docker Images And Networks

| Variable | Required | Description |
| --- | --- | --- |
| `DOCKER_BACKEND_IMAGE` | Image build/prod | Backend image name without tag. |
| `DOCKER_FRONTEND_IMAGE` | Image build/prod | Frontend image name without tag. |
| `DOCKER_IMAGE_TAG` | Prod compose | Image tag. Empty is allowed for build script auto tag, but prod compose requires it. |
| `DOCKER_IMAGE_OUTPUT_DIR` | Image script | Directory for exported image archives. |
| `BACKEND_CONTAINER_NAME` | Prod compose | Backend container name. |
| `FRONTEND_CONTAINER_NAME` | Prod compose | Frontend container name. |
| `COTURN_CONTAINER_NAME` | Prod compose | Coturn container name. |
| `COTURN_IMAGE` | Prod compose | Coturn image reference. |
| `DOCKER_INTERNAL_NETWORK` | Prod compose | Private app network. |
| `DOCKER_PROXY_NETWORK` | Prod compose | External reverse-proxy network. |

## Production Example

```text
PUBLIC_DOMAIN=meet.example.com
PUBLIC_ORIGIN=https://meet.example.com
ALLOWED_ORIGINS=https://meet.example.com
NEXT_PUBLIC_API_BASE_URL=browser-origin
NEXT_PUBLIC_WS_URL=browser-origin
TURN_PUBLIC_IP=203.0.113.10
NEXT_PUBLIC_TURN_PUBLIC_IP=203.0.113.10
TURN_PORT=3478
TURN_HOST_PORT=3478
TURN_RELAY_PORT_MIN=43000
TURN_RELAY_PORT_MAX=43100
TURN_REALM=meet.example.com
SFU_AUTO_PEER_THRESHOLD=2
WEBRTC_UDP_PORT_MIN=40000
WEBRTC_UDP_PORT_MAX=40100
WEBRTC_UDP_HOST_PORT_MIN=40000
WEBRTC_UDP_HOST_PORT_MAX=40100
BACKEND_INTERNAL_URL=http://backend:8080
```
