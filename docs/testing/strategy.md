# Testing Strategy

meet37 uses backend Go tests, frontend Vitest tests, Playwright E2E tests, TypeScript checks, linting, production builds, and Docker compose validation.

## Backend Tests

Run:

```bash
cd backend
go test ./...
```

Current backend test areas include:

- Database open/migration behavior.
- HTTP handlers.
- Middleware.
- Signaling.
- SFU manager.

Build check:

```bash
go build -o /tmp/meet-server ./cmd/server
```

## Frontend Checks

Run:

```bash
cd frontend
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Current frontend test areas include:

- API client.
- Token storage.
- Hooks.
- Zustand stores.
- Message router.
- WebRTC peer connection factory.
- SFU client.
- Login form.
- Admin panel.
- Control bar.
- Device setup.
- File transfer item.
- Room password modal.
- Video grid.
- Video tile.

## E2E Tests

Run:

```bash
cd frontend
pnpm test:e2e
```

Playwright starts the frontend dev server on port `3001` unless `FRONTEND_BASE_URL` is set.

Configured projects:

- Chromium.
- Firefox.

## Docker Validation

Development compose:

```bash
docker compose --env-file .env.example config -q
```

Production compose:

```bash
DOCKER_IMAGE_TAG=ci docker compose --env-file .env.example -f docker-compose.prod.yml config -q
```

Image builds:

```bash
docker build -t meet37-backend:ci -f backend/Dockerfile backend
docker build \
  -t meet37-frontend:ci \
  -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=browser-origin \
  --build-arg NEXT_PUBLIC_WS_URL=browser-origin \
  --build-arg NEXT_PUBLIC_TURN_PUBLIC_IP=127.0.0.1 \
  --build-arg BACKEND_INTERNAL_URL=http://backend:8080 \
  --build-arg FRONTEND_PORT=3000 \
  frontend
```

## Manual Media Test Matrix

Because browser media behavior depends on real devices and network conditions, every release should manually test:

- Two desktop browsers on the same network.
- Two desktop browsers on different networks.
- One desktop and one mobile browser.
- Camera on/off multiple times.
- Microphone on/off multiple times.
- Screen share on/off where supported.
- Speaker indicator on remote clients.
- File transfer with a small file.
- File transfer after sender refresh/rejoin.
- Join with duplicate display name.
- Join approval flow.

## CI

GitHub Actions CI runs on pull requests and pushes to `production`. See [CI/CD](../deployment/ci-cd.md).
