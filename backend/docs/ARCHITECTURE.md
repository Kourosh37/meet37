# Architecture

## Purpose

The backend is a coordination service for a browser meeting app. It intentionally keeps real-time media in WebRTC browser transports and handles the backend-owned parts of the product:

- Authentication and authorization.
- Admin configuration.
- Room metadata and persistence.
- Shared link lookup.
- WebSocket signaling.
- Admission control.
- Host moderation.
- Quality monitoring decisions.
- TURN/SFU fallback metadata.

## High-Level Components

```text
Browser frontend
  REST API: auth, rooms, admin
  WebSocket: signaling, chat, moderation, quality stats
        |
        v
Go HTTP server
  cmd/server
        |
        +-- handlers: REST + WebSocket entrypoints
        +-- middleware: CORS, logging, JWT auth
        +-- signaling: in-memory room peers and WebSocket routing
        +-- sfu: fallback session and TURN credential metadata
        +-- db: SQLite connection and migrations
        +-- models: shared response/message types
        +-- config: environment configuration
        |
        v
SQLite database under /data
```

## Package Layout

```text
backend/
  cmd/server/main.go              HTTP server bootstrap and routing
  internal/config/config.go       Environment loading
  internal/db/db.go               SQLite open/migrate logic
  internal/models/models.go       API and signaling models
  internal/handlers/              REST and WebSocket HTTP handlers
  internal/middleware/            CORS, logging, JWT middleware
  internal/signaling/             WebSocket hub, room peers, moderation
  internal/sfu/                   Fallback session and TURN credentials
  data/.gitkeep                   Runtime data directory placeholder
  docs/                           Backend documentation
```

## Request Flow

### Admin Login

1. Frontend posts username/password to `POST /api/auth/login`.
2. Backend compares admin credentials against environment variables.
3. Backend returns a JWT with `is_admin: true`.
4. Frontend stores the token and uses `Authorization: Bearer <token>` for admin APIs.

### User Login

1. Admin creates users through `/api/admin/users`.
2. User posts credentials to `POST /api/auth/login`.
3. Backend verifies bcrypt password hash from SQLite.
4. Backend returns a JWT with `is_admin: false`.

### Room Creation

1. Frontend posts to `POST /api/rooms`.
2. Backend checks current app mode.
3. In `public` mode, anonymous creation is allowed.
4. In `private` mode, a valid admin/user JWT is required.
5. Backend stores room metadata and returns a room-scoped `host_token`.
6. Frontend stores `host_token` for the room creator session.

### Shared Room Join

1. Visitor opens a frontend route such as `/meet/{room_id}`.
2. Frontend calls `GET /api/rooms/{id}` to load metadata.
3. Frontend asks for display name and device permissions.
4. Frontend opens `GET /ws`.
5. Frontend sends a WebSocket `join` message with `room_id` and `display_name`.
6. Backend either joins the peer directly or queues them for host approval.

## Runtime State

The database stores durable configuration and room metadata. Active WebSocket peers are kept in memory:

- `rooms`: active in-memory rooms keyed by room ID.
- `peers`: approved connected peers.
- `pending`: approval-mode peers waiting for host decision.
- `sfuSession`: per-room fallback session metadata.

This means a single backend instance owns live signaling state. Horizontal scaling requires a shared signaling layer or sticky sessions.

## Persistence

SQLite is stored at `DB_PATH`, defaulting to `/data/meet.db`.

SQLite is configured with:

- WAL journal mode.
- Normal synchronous mode.
- Busy timeout.
- Foreign keys enabled.
- Single open DB connection to avoid SQLite writer contention.

## WebRTC Responsibility Split

Backend:

- Signals SDP offers/answers and ICE candidates.
- Coordinates chat messages.
- Coordinates file-transfer metadata.
- Emits mute/kick/admission messages.
- Emits `sfu-switch` instructions when client stats are poor.

Frontend:

- Calls `getUserMedia` and `getDisplayMedia`.
- Creates `RTCPeerConnection` instances.
- Sends/receives media tracks.
- Opens WebRTC data channels for chat/file bytes if desired.
- Applies mute requests locally.
- Performs reconnection and UI state transitions.

