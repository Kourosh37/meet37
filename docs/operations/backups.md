# Backups And Recovery

meet37 stores backend data in SQLite at `DB_PATH`. In Docker production, this is usually mounted under:

```text
/opt/meet37/data/backend/
```

## What To Back Up

Back up the production deployment directory:

```text
/opt/meet37/.env
/opt/meet37/docker-compose.prod.yml
/opt/meet37/data/backend/
```

The most important file is the SQLite database:

```text
data/backend/meet.db
```

SQLite WAL files may also exist:

```text
meet.db-wal
meet.db-shm
```

Back them up together.

## What Is Not Stored

File transfer bytes are not stored on the backend. The backend only stores file-transfer metadata. If a transferred file must remain downloadable after all peers leave, a future server-side file storage feature is required.

## Backup Command

Stop the stack for the simplest consistent backup:

```bash
cd /opt/meet37
docker compose -f docker-compose.prod.yml down
tar -czf meet37-backup-$(date +%Y%m%d-%H%M%S).tar.gz .env docker-compose.prod.yml data
docker compose -f docker-compose.prod.yml up -d
```

For low-downtime backups, use SQLite backup tooling or snapshot the full `data/backend` directory in a way that preserves WAL consistency.

## Restore

```bash
cd /opt/meet37
docker compose -f docker-compose.prod.yml down
tar -xzf meet37-backup-<timestamp>.tar.gz
docker compose -f docker-compose.prod.yml up -d
```

Then validate:

```bash
docker compose -f docker-compose.prod.yml ps
curl -i https://meet.example.com/api/settings
```

## Recovery Checklist

- Restore `.env`.
- Restore `docker-compose.prod.yml`.
- Restore `data/backend`.
- Load or pull matching Docker images.
- Confirm `DOCKER_IMAGE_TAG`.
- Start compose.
- Validate API, room creation, join, WebSocket, media, chat, and file metadata.
