# Testing Guide

## Static Checks

Run:

```bash
cd backend
go test ./...
go vet ./...
```

## Docker Checks

Build the production image:

```bash
docker build -t meet-backend:docker-test .
```

Run a container with a temporary `/data` volume and verify:

- `GET /health`
- admin login
- app mode switching
- public/private room creation policy
- room metadata lookup
- chat/file history endpoints
- admin SFU stats endpoint
- refresh-token rotation and logout
- Docker image health status

The repository includes package-level tests for:

- SQLite migration and default settings.
- Auth login and refresh-token rotation/replay rejection.
- Room chat/file history handlers.
- Real WebSocket room join, chat relay, and chat persistence.
- Admin SFU stats handler.
- Rate limiting and body-size middleware.
- SFU offer/answer and existing-track renegotiation behavior.

## Manual Runtime Checks

Start the server:

```bash
DB_PATH=./data/dev.db go run ./cmd/server
```

Check health:

```bash
curl http://localhost:8080/health
```

Check admin login:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"change_me_strong_password"}'
```

## End-To-End Smoke Coverage

The latest runtime verification covered:

- Server build.
- Health endpoint.
- Admin login.
- Admin settings read/write.
- Admin user create/list/update/delete.
- User login.
- Private-mode room creation requiring authentication.
- Public-mode room creation without authentication.
- Room metadata lookup.
- WebSocket host join with `host_token`.
- Approval-mode guest waiting flow.
- Host approval.
- Guest joining after approval.
- Poor quality stats triggering `sfu-switch`.
- Host receiving `peer-mode-changed`.
- Host mute command.
- Guest receiving `mute-request`.
- Host kick command.
- Guest receiving `kicked`.
- Host receiving `peer-left`.
- Admin room stats.
- Admin SFU stats.
- Chat history endpoint.
- File-transfer metadata history endpoint.
- Docker image build.
- Docker container startup and health endpoint.
- Refresh-token rotation.
- Logout refresh-token revocation.
- SFU offer/answer generation through Pion.

## Additional Automated Tests To Add As The Frontend Lands

Backend unit/integration tests:

- User CRUD.
- Public/private room creation policy.
- Room password validation.
- Host token validation.
- WebSocket approval flow.
- WebSocket moderation flow.
- SFU fallback threshold behavior.
- Redis-backed cross-instance signaling using a disposable Redis container.

Frontend E2E tests:

- Public room create and join.
- Private room create with user login.
- Approval waiting screen.
- Host approval modal.
- Mute and kick UI.
- WebRTC offer/answer/ICE path.
- File transfer over data channel.
