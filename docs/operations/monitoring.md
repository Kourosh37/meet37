# Monitoring

meet37 currently exposes operational signals through HTTP health checks, Docker health state, backend logs, frontend logs, admin stats endpoints, and browser-side quality indicators.

## Health Endpoints

Backend:

```text
GET /health
```

Returns `200 OK` with body `ok`.

Public API smoke endpoint:

```text
GET /api/settings
```

Returns the current app mode.

## Docker Health

Both compose files use health checks driven by:

- `BACKEND_HEALTHCHECK_URL`
- `FRONTEND_HEALTHCHECK_URL`

Check:

```bash
docker compose ps
docker inspect meet37-backend --format '{{json .State.Health}}'
```

## Logs

Backend logs are structured with zerolog in production. Monitor:

- Request paths and duration.
- WebSocket read failures.
- Dropped messages for slow peers.
- SFU offer failures.
- Healthcheck failures.

Frontend logs are standard Next.js container logs. Monitor:

- Startup failures.
- Rewrite/backend connection failures.
- Build/runtime env errors.

## Admin Stats

Admin-only endpoints:

- `GET /api/admin/rooms/{roomId}/stats`
- `GET /api/admin/sfu/stats`

Room stats include:

- Active flag.
- Peer count.
- Pending count.
- Internal peer mode counts.
- SFU session presence.

The internal peer mode values are operational details and should not be shown to normal meeting users.

## Browser Quality

The meeting UI collects quality snapshots:

- Bitrate.
- Packet loss.
- RTT.
- Jitter when available.

The UI connection quality indicator should reflect these values in a user-friendly way.

## Alert Recommendations

Alert when:

- Backend container is unhealthy.
- Frontend container is down.
- `/api/settings` fails from public origin.
- Caddy returns repeated 502.
- Backend logs repeated WebSocket upgrade/read failures.
- SFU offer failures spike.
- Disk usage for `data/` is high.
