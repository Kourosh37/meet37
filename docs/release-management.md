# Release Management

## Branch Policy

CI/CD runs production deployment logic from the `production` branch.

## Image Tags

CD uses the short git SHA as the image tag:

```text
<short-sha>
```

Manual offline builds can use:

```bash
python scripts/build_docker_images.py --version 2026-06-02-1
```

## Pre-Release Validation

Run:

```bash
cd backend
go test ./...
go build -o /tmp/meet-server ./cmd/server
```

```bash
cd frontend
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

```bash
docker compose --env-file .env.example config -q
DOCKER_IMAGE_TAG=ci docker compose --env-file .env.example -f docker-compose.prod.yml config -q
```

## Production Deployment

Automatic CD:

1. Push to `production`.
2. GitHub Actions builds backend and frontend images.
3. Images are pushed to GHCR.
4. Optional SSH deploy runs when `ENABLE_SSH_DEPLOY=true`.

Manual deployment:

1. Build or pull images.
2. Update `.env` image names and tag.
3. Run server requirement check.
4. Run production compose.

## Smoke Test

After release:

- Open public origin.
- Call `/api/settings`.
- Login as admin.
- Create a room.
- Join with a second client.
- Toggle microphone, camera, and screen share where supported.
- Send chat.
- Send a small file.
- Check mobile viewport.
- Check backend/frontend logs.

## Rollback

1. Set `DOCKER_IMAGE_TAG` to previous working tag.
2. Run:

```bash
docker compose -f docker-compose.prod.yml up -d
```

3. Validate health and smoke tests.

Database rollback is separate. Do not restore an old database unless the release changed durable data in a way that requires it.
