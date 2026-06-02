# Contribution Guide

## Branching

Production CI/CD is tied to the `production` branch.

Recommended flow:

1. Create a feature branch.
2. Make focused changes.
3. Run local validation.
4. Open a pull request.
5. Merge to `production` only when release-ready.

## Local Setup

Start with:

```bash
cp .env.example .env
docker compose up --build
```

For direct development, see [Local Development](setup/local-development.md).

## Code Standards

Backend:

- Keep handlers small and explicit.
- Keep shared behavior in internal packages.
- Prefer structured errors and clear status codes.
- Add Go tests for backend behavior changes.

Frontend:

- Keep feature code under `frontend/src/features`.
- Keep reusable primitives under `frontend/src/components` or `frontend/src/lib`.
- Use existing stores/hooks before adding new state systems.
- Use responsive UI rules documented in product/architecture docs.
- Do not expose implementation terms such as P2P/SFU to normal users.

## Documentation Standards

- Update `docs/` for any behavior, deployment, API, WebSocket, security, or operational change.
- Keep root `README.md` short.
- Do not recreate module-level documentation trees.

## Validation Checklist

Run what matches the change:

```bash
cd backend && go test ./...
cd frontend && pnpm typecheck && pnpm lint && pnpm test
docker compose --env-file .env.example config -q
DOCKER_IMAGE_TAG=ci docker compose --env-file .env.example -f docker-compose.prod.yml config -q
```

For frontend production-impacting changes:

```bash
cd frontend && pnpm build
```

For deployment changes:

```bash
python scripts/check_server_requirements.py
python scripts/build_docker_images.py --version test
```

## Pull Request Checklist

- Scope is clear.
- Tests were added or updated when behavior changed.
- Docs were updated.
- `.env.example` was updated when configuration changed.
- No secrets were committed.
- Docker compose still validates.
- UI changes were checked on desktop and mobile when relevant.
