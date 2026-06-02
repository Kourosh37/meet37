# CI/CD

## Purpose

Document the GitHub Actions CI/CD pipeline for meet37.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to the `production` branch.

It validates:

- Backend Go tests and build.
- Frontend install, typecheck, lint, tests, and production build.
- Docker Compose configuration.
- Backend and frontend Docker image builds.

## CD

`.github/workflows/cd.yml` runs on pushes to the `production` branch and can also be started manually with `workflow_dispatch`.

It builds and pushes:

- `ghcr.io/<owner>/meet37-backend:<short-sha>`
- `ghcr.io/<owner>/meet37-frontend:<short-sha>`
- `latest` tags for both images.

Deploy over SSH is optional and only runs when this repository variable is set:

```text
ENABLE_SSH_DEPLOY=true
```

Required repository secrets for SSH deploy:

```text
SSH_HOST
SSH_USER
SSH_KEY
DEPLOY_PATH
```

Optional repository secrets:

```text
SSH_PORT
GHCR_USERNAME
GHCR_TOKEN
```

Set `GHCR_USERNAME` and `GHCR_TOKEN` if the server must authenticate before pulling GHCR images.

Optional repository variables used during image build:

```text
BACKEND_INTERNAL_URL
FRONTEND_PORT
NEXT_PUBLIC_TURN_PUBLIC_IP
```

The deploy job copies these files to the server:

```text
docker-compose.prod.yml
.env.example
scripts/check_server_requirements.py
```

Then it updates `.env` with the pushed image names and tag, validates server requirements, pulls images, and runs:

```bash
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

The server must already have Docker, Docker Compose, Python 3, and the reverse-proxy network configured or allowed to be created by the requirements script.

## Planned Expansion

- Required repository settings.
- GHCR permissions.
- Deployment rollback.
- Manual release checklist.
- Production branch policy.
