# Meet Backend

Production-oriented Go backend for a browser-based meeting product. The backend provides authentication, admin-controlled public/private access, room lifecycle APIs, public shared-room joining, WebSocket signaling, room admission control, host moderation, file-transfer signaling, and quality-stat based fallback metadata for server-assisted transport.

Media itself is browser-side WebRTC. Camera, microphone, screen share, and file payloads are not proxied through the REST API. This service is responsible for coordination, authorization, signaling, persistence, and operational controls.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Business Logic](docs/BUSINESS_LOGIC.md)
- [P2P-First Media And Fallback](docs/P2P_FIRST_MEDIA.md)
- [Browser-To-Browser File Sharing](docs/FILE_SHARING.md)
- [Horizontal Scaling](docs/SCALING.md)
- [REST API](docs/API.md)
- [WebSocket Protocol](docs/WEBSOCKET.md)
- [Frontend Integration Guide](docs/FRONTEND_GUIDE.md)
- [Configuration](docs/CONFIGURATION.md)
- [Data Model](docs/DATA_MODEL.md)
- [Local Runbook](docs/RUNBOOK.md)
- [Docker And Deployment](docs/DOCKER.md)
- [Security Notes](docs/SECURITY.md)
- [Testing Guide](docs/TESTING.md)

## Quick Start

```bash
cd backend
cp .env.example .env
go mod download
go run ./cmd/server
```

The service listens on `http://localhost:8080` by default.

```bash
curl http://localhost:8080/health
```

Expected response:

```text
ok
```

## Docker Quick Start

```bash
cd backend
cp .env.example .env
docker compose up --build
```

SQLite data is stored in `/data` inside the container and persisted through the `meet-data` volume.

## Current Scope

Implemented:

- Admin login from environment credentials.
- JWT auth for admin/users.
- Admin settings: public/private mode.
- Admin user CRUD for private-mode creators.
- Public-mode anonymous room creation.
- Private-mode authenticated room creation.
- Shared room links joinable without account login.
- Room `open` and `approval` join policies.
- Per-room `host_token` for creator moderation controls.
- WebSocket signaling relay for WebRTC offer/answer/ICE.
- Pion-based SFU media relay with RTP forwarding for fallback mode.
- Chat signaling.
- File-transfer signaling metadata relay.
- Rotating refresh-token sessions and logout revocation.
- Per-IP rate limiting and request body limits.
- Optional Redis shared signaling for multi-instance deployments.
- Host approval/rejection, mute request, and kick.
- Quality stats ingestion and `sfu-switch` fallback instruction.
- SQLite persistence with WAL and runtime data under `/data`.
- Dockerfile and Docker Compose setup.

Not implemented yet:

- Production-grade SFU layer selection, recording, simulcast policy, and observability.
- Fully distributed waiting-room host approval commands across non-sticky instances.
- Persistent chat/file history.

## Verification

The current codebase has been checked with:

```bash
go test ./...
go vet ./...
```

An end-to-end smoke test was also run against a real local server, covering:

- Health check.
- Admin login.
- Admin user create/list/update/delete.
- Public/private app mode switching.
- Private-mode room creation authorization.
- Public room creation with `host_token`.
- WebSocket host join.
- Approval-mode guest join request and approval.
- SFU fallback message after poor stats.
- Host mute and kick commands.
- Refresh-token rotation and logout.
- Pion SFU offer/answer handling.
