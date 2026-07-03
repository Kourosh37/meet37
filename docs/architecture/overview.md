# Architecture Overview

meet37 is split into a Go backend and a Next.js frontend. The frontend serves the browser experience and owns WebRTC client behavior. The backend owns HTTP APIs, authentication, room persistence, WebSocket signaling, room membership, moderation, chat persistence, file-transfer metadata, and SFU/media coordination.

## Runtime Topology

```text
Browser
  |
  | HTTPS / WSS
  v
Caddy container
  |
  | HTTP to frontend container
  v
Next.js frontend
  |
  | /api and /ws rewrites through BACKEND_INTERNAL_URL
  v
Go backend
  |
  | SQLite database at DB_PATH
  v
Persistent data volume
```

WebRTC media uses peer connections between browsers when possible and backend/SFU coordination when needed. UDP media reliability depends on `TURN_PUBLIC_IP`, `TURN_PORT`, `WEBRTC_UDP_PORT_MIN`, and `WEBRTC_UDP_PORT_MAX` being reachable from clients.

## Backend Responsibilities

- Load environment configuration from process environment.
- Open and migrate SQLite.
- Expose HTTP APIs under `/api`.
- Expose health check at `/health`.
- Upgrade WebSocket connections at `/ws`.
- Authenticate access tokens and admin-only endpoints.
- Enforce room creation and join rules.
- Maintain in-memory live room state.
- Relay WebRTC signaling messages.
- Persist chat messages and file-transfer metadata.
- Manage optional Redis-backed cluster coordination.
- Manage SFU sessions and media stats.

## Frontend Responsibilities

- Render public, auth, admin, and meeting routes.
- Resolve public API and WebSocket URLs from environment variables.
- Use Next.js rewrites so `/api` and `/ws` can share the same public origin.
- Manage authentication tokens and refresh flow.
- Manage room creation and joining.
- Capture local camera, microphone, and screen-share streams.
- Create and maintain peer connections.
- Handle SFU switch/renegotiation signals.
- Render participant tiles, media states, speaking indicators, and connection quality.
- Manage chat and file transfer UI.
- Persist local file-share metadata in IndexedDB.

## Data Flow Summary

HTTP APIs handle durable actions such as login, room creation, metadata lookup, admin operations, chat history, and file history.

WebSocket messages handle real-time actions such as joining, leaving, WebRTC offers/answers, ICE candidates, media state, audio level, chat, file transfer negotiation, stats, moderation, and SFU events.

WebRTC media and file bytes flow outside normal HTTP requests. Media tracks use `RTCPeerConnection`; file bytes use `RTCDataChannel`.

## Persistence

SQLite is the default database. It stores settings, users, rooms, room events, refresh sessions, chat messages, and file-transfer metadata. In-memory state is used for live peers and pending participants. Redis can be configured for multi-instance signaling state, but it is optional for single-instance deployments.

## Deployment Shapes

- `docker-compose.yml` builds local backend/frontend images from source.
- `docker-compose.prod.yml` runs prebuilt backend/frontend images with coturn and Caddy in one production stack.
- `scripts/build_images.py` builds backend/frontend/runtime images and exports one `.tar.gz` image bundle.
- `scripts/prepare_server.py` prepares server env, Docker networks, firewall rules, and OS media settings.

## Design Constraints

- Production browser media requires HTTPS.
- WebSocket must be proxied correctly by the reverse proxy.
- UDP media ports must be published by Docker and allowed by the server firewall.
- Public WebRTC IP/host values must be reachable by the clients, not just by the server.
- Screen sharing cannot be forced on browsers that do not implement `getDisplayMedia`.
