# Testing Guide

## Static Checks

Run:

```bash
cd backend
go test ./...
go vet ./...
```

The current codebase has no package-level test files yet, so `go test` validates compilation across all packages.

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

## Recommended Automated Tests To Add

Backend unit/integration tests:

- Config default loading.
- SQLite migration idempotency.
- Admin login success/failure.
- User CRUD.
- Public/private room creation policy.
- Room password validation.
- Host token validation.
- WebSocket approval flow.
- WebSocket moderation flow.
- SFU fallback threshold behavior.

Frontend E2E tests:

- Public room create and join.
- Private room create with user login.
- Approval waiting screen.
- Host approval modal.
- Mute and kick UI.
- WebRTC offer/answer/ICE path.
- File transfer over data channel.

