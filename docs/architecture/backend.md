# Backend Architecture

The backend is a Go service. It exposes HTTP APIs, WebSocket signaling, SQLite persistence, middleware, room membership, optional Redis cluster coordination, and SFU/media coordination.

## Package Structure

```text
backend/cmd/server/main.go       application entry point
backend/internal/config/         environment configuration
backend/internal/db/             SQLite open and migration logic
backend/internal/handlers/       HTTP and WebSocket handlers
backend/internal/middleware/     auth, admin, CORS, rate limit, body limit, logging
backend/internal/models/         shared API/signaling models
backend/internal/signaling/      WebSocket hub and live room state
backend/internal/sfu/            Pion WebRTC SFU/session management
backend/internal/cluster/        optional Redis-backed coordination
```

## Startup Flow

1. `config.Load()` reads environment variables.
2. `db.Open()` opens SQLite at `DB_PATH`, enables WAL, and runs migrations.
3. SFU manager and optional cluster bus are created.
4. The signaling hub is created and cluster listeners start when Redis is enabled.
5. HTTP handlers are registered on a `http.ServeMux`.
6. Middleware wraps the mux with CORS, max body size, rate limiting, and logging.
7. The server listens on `PORT`.
8. SIGINT/SIGTERM triggers graceful shutdown with a 10 second timeout.

## HTTP Surface

The backend exposes:

- `/health`
- `/api/settings`
- `/api/auth/login`
- `/api/auth/refresh`
- `/api/auth/logout`
- `/api/auth/register`
- `/api/rooms`
- `/api/rooms/{roomId}`
- `/api/rooms/{roomId}/chat`
- `/api/rooms/{roomId}/files`
- `/api/admin/settings`
- `/api/admin/users`
- `/api/admin/users/{userId}`
- `/api/admin/rooms/{roomId}/stats`
- `/api/admin/sfu/stats`
- `/ws`

## Middleware

The backend uses:

- Optional authentication for room and WebSocket flows.
- Required authentication for protected endpoints.
- Admin-only checks for admin endpoints.
- CORS based on `ALLOWED_ORIGINS`.
- Per-IP rate limiting using `RATE_LIMIT_RPS` and `RATE_LIMIT_BURST`.
- Maximum body size using `MAX_BODY_BYTES`.
- Structured request logging with zerolog.

## Room State

Durable room metadata is stored in SQLite. Live room state is held in the signaling hub:

- Active peers.
- Pending peers waiting for host approval.
- Per-peer mode.
- Room SFU session reference.

When the last active/pending peer leaves, the in-memory room session is closed. The SQLite room row remains until deleted or expired by normal room listing filters.

## Signaling Hub

The hub owns WebSocket peers and routes real-time messages:

- `join` validates and places the peer in active or pending state.
- `offer`, `answer`, `ice-candidate`, and `file-candidate` are relayed to target peers.
- `media-state`, `audio-level`, and `chat` are broadcast to other peers.
- `file-offer` and `file-answer` are persisted and relayed.
- `stats` may trigger SFU fallback.
- `sfu-offer` and `sfu-ice-candidate` are handled by the SFU manager.
- `approve-peer`, `reject-peer`, `kick-peer`, and `mute-peer` implement host moderation.

## Optional Clustering

When `REDIS_URL` is configured, the cluster bus can publish/consume cross-instance room events. This supports relays, broadcasts, pending approvals, peer records, and room closure across backend instances.

Single-instance deployments should leave `REDIS_URL` empty.

## Persistence

SQLite is opened with:

- WAL journal mode.
- Busy timeout.
- Normal synchronous mode.
- Foreign keys enabled.
- One open connection and one idle connection.

The schema is created automatically on startup. See [Data Model](data-model.md).
