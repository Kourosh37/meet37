# Operations Runbook

This runbook is for production operators.

## First Server Setup

1. Install Docker, Docker Compose, and Python 3.
2. Create the deployment directory:

```bash
mkdir -p /opt/meet37/data/backend
cd /opt/meet37
```

3. Copy:

```text
docker-compose.prod.yml
.env
scripts/check_server_requirements.py
```

4. Create the reverse-proxy network if it does not exist:

```bash
docker network create proxy
```

5. Validate and fix server requirements:

```bash
python3 scripts/check_server_requirements.py --compose-file docker-compose.prod.yml --fix
```

6. Start:

```bash
docker compose -f docker-compose.prod.yml up -d
```

## Daily Health Check

```bash
cd /opt/meet37
docker compose -f docker-compose.prod.yml ps
curl -i https://meet.example.com/api/settings
docker compose -f docker-compose.prod.yml logs --tail=50 backend
docker compose -f docker-compose.prod.yml logs --tail=50 frontend
```

Expected:

- Frontend container is running.
- Backend container is healthy.
- Coturn container is running.
- `/api/settings` returns JSON.
- No repeated WebSocket, database, coturn allocation, or healthcheck failures in logs.

## Restart

```bash
cd /opt/meet37
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml ps
```

## Stop

```bash
cd /opt/meet37
docker compose -f docker-compose.prod.yml down
```

## Upgrade

1. Pull or load new images.
2. Update `DOCKER_IMAGE_TAG` in `.env`.
3. Validate compose:

```bash
docker compose --env-file .env -f docker-compose.prod.yml config -q
```

4. Start new containers:

```bash
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

5. Smoke test meeting flows.

## Rollback

```bash
cd /opt/meet37
sed -i 's/^DOCKER_IMAGE_TAG=.*/DOCKER_IMAGE_TAG=<previous-tag>/' .env
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Do not delete `data/` during rollback unless restoring from backup.

## Media Port Check

Check published ports:

```bash
docker ps
ss -lunpt | grep -E '(:3478|:43000|:43100|:40000|:40100)' || true
ufw status verbose || true
```

Adjust the grep ports to match `.env`.

## Logs

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f coturn
```

For Caddy:

```bash
docker logs caddy --tail=200
```

## Emergency Checklist

- Is the domain resolving to the right server?
- Is Caddy running?
- Is the frontend container connected to the proxy network?
- Is the backend healthy?
- Does `/api/settings` work?
- Does `/ws` connect from the browser?
- Are TURN/media UDP ports published and allowed?
- Are coturn relay UDP ports published and allowed?
- Is `TURN_PUBLIC_IP` reachable by clients?
