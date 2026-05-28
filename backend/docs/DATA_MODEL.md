# Data Model

SQLite is the durable store. Active WebSocket peer state is in memory.

## `settings`

Single-row table.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer | Always `1`. |
| `app_mode` | text | `public` or `private`. |

## `users`

Admin-created users allowed to create rooms in private mode.

| Column | Type | Description |
| --- | --- | --- |
| `id` | text | UUID. |
| `username` | text | Unique, case-insensitive. |
| `password` | text | Bcrypt hash. |
| `created_at` | integer | Unix timestamp. |

Admin credentials are not stored in this table.

## `rooms`

Room metadata.

| Column | Type | Description |
| --- | --- | --- |
| `id` | text | UUID room ID. |
| `name` | text | Room name. |
| `host_id` | text | User ID, `admin`, or generated `guest:<uuid>`. |
| `is_locked` | integer | Reserved lock flag. |
| `password` | text | Optional bcrypt room password hash. |
| `join_policy` | text | `open` or `approval`. |
| `host_secret_hash` | text | Bcrypt hash for room host token validation. |
| `max_peers` | integer | Room capacity. |
| `created_at` | integer | Unix timestamp. |
| `expires_at` | integer/null | Expiry timestamp or no expiry. |

## `room_events`

Minimal audit/event stream for joins and leaves.

| Column | Type | Description |
| --- | --- | --- |
| `id` | integer | Autoincrement ID. |
| `room_id` | text | Room ID. |
| `user_id` | text/null | Authenticated user ID when available. |
| `event` | text | `join` or `leave`. |
| `ts` | integer | Unix timestamp. |

## `refresh_sessions`

Rotating refresh-token sessions.

| Column | Type | Description |
| --- | --- | --- |
| `id` | text | Session UUID. |
| `user_id` | text | `admin` or user UUID. |
| `username` | text | Username snapshot. |
| `is_admin` | integer | Admin flag snapshot. |
| `token_hash` | text | SHA-256 hash of refresh token. |
| `created_at` | integer | Unix timestamp. |
| `expires_at` | integer | Unix timestamp. |
| `revoked_at` | integer/null | Revocation timestamp. |

## In-Memory Runtime State

The signaling hub stores:

- Active rooms.
- Approved peers.
- Pending peers waiting for host approval.
- Per-room fallback session metadata.

This state is lost on server restart. Durable room records remain in SQLite, but connected peers must reconnect.
