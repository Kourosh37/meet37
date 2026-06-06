# Data Model

meet37 uses SQLite for durable backend data and in-memory Go structs for live room state. The database is created and migrated automatically at startup.

## SQLite Configuration

The backend opens `DB_PATH` with:

- WAL journal mode.
- Busy timeout of 5000 ms.
- Normal synchronous mode.
- Foreign keys enabled.
- One open connection and one idle connection.

The default Docker path is `/data/meet.db`.

## Tables

### `settings`

Stores application-level settings.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | Always `1` |
| `app_mode` | text | `public` or `private` |

### `users`

Stores non-admin users created through registration/admin flows.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text | Meet-style room ID, `aaa-aaa-aaa` |
| `username` | text | Unique, case-insensitive |
| `password` | text | bcrypt hash |
| `created_at` | integer | Unix timestamp |

The environment admin is not stored in this table; it comes from `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

### `rooms`

Stores room metadata.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text | UUID |
| `name` | text | Room name |
| `host_id` | text | Auth user ID or generated guest host ID |
| `is_locked` | integer | Lock flag |
| `password` | text | Optional bcrypt hash |
| `join_policy` | text | `open` or `approval` |
| `host_secret_hash` | text | Hash for host token validation |
| `max_peers` | integer | Room capacity |
| `created_at` | integer | Unix timestamp |
| `expires_at` | integer | Optional Unix timestamp |

### `room_events`

Stores join/leave events.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | Autoincrement |
| `room_id` | text | Room ID |
| `user_id` | text | Optional authenticated user ID |
| `event` | text | `join` or `leave` |
| `ts` | integer | Unix timestamp |

### `refresh_sessions`

Stores refresh token sessions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text | UUID |
| `user_id` | text | User ID or `admin` |
| `username` | text | Username |
| `is_admin` | integer | Admin flag |
| `token_hash` | text | SHA-256 hash of refresh token |
| `created_at` | integer | Unix timestamp |
| `expires_at` | integer | Unix timestamp |
| `revoked_at` | integer | Optional Unix timestamp |

### `chat_messages`

Stores room chat history.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | Autoincrement |
| `room_id` | text | Room ID |
| `peer_id` | text | Live peer ID at send time |
| `user_id` | text | Optional authenticated user ID |
| `display_name` | text | Sender display name |
| `text` | text | Message body |
| `ts` | integer | Unix timestamp |

### `file_transfers`

Stores file-transfer metadata.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer | Autoincrement |
| `room_id` | text | Room ID |
| `file_id` | text | Client file ID |
| `sender_peer_id` | text | Sender peer ID |
| `target_peer_id` | text | Optional receiver peer ID |
| `name` | text | File name |
| `size` | integer | File size in bytes |
| `mime` | text | MIME type |
| `status` | text | Offered, answered, rejected, etc. |
| `reason` | text | Optional rejection/failure reason |
| `ts` | integer | Unix timestamp |

### `room_peer_permissions`

Stores durable per-participant room permissions. The `identity` is `user:{user_id}` for authenticated users and `name:{display_name}` for guests.

| Column | Type | Notes |
| --- | --- | --- |
| `room_id` | text | Room ID |
| `identity` | text | Durable participant identity key |
| `can_use_mic` | integer | Boolean flag |
| `can_use_camera` | integer | Boolean flag |
| `can_share_screen` | integer | Boolean flag |
| `can_chat` | integer | Boolean flag |
| `can_react` | integer | Boolean flag |
| `updated_at` | integer | Unix timestamp |

### `room_admin_permissions`

Stores durable in-room admin grants assigned by the host.

| Column | Type | Notes |
| --- | --- | --- |
| `room_id` | text | Room ID |
| `identity` | text | Durable participant identity key |
| `can_kick` | integer | Boolean flag |
| `can_mute_mic` | integer | Boolean flag |
| `can_disable_camera` | integer | Boolean flag |
| `can_disable_screen` | integer | Boolean flag |
| `can_disable_chat` | integer | Boolean flag |
| `can_disable_emoji` | integer | Boolean flag |
| `updated_at` | integer | Unix timestamp |

### `room_bans`

Stores active temporary or permanent rejoin blocks.

| Column | Type | Notes |
| --- | --- | --- |
| `room_id` | text | Room ID |
| `identity` | text | Durable participant identity key |
| `banned_until` | integer | Unix timestamp, or `0` for permanent |
| `created_at` | integer | Unix timestamp |

### `room_default_permissions`

Stores room-level default permissions used for future joins and optionally applied to current participants.

| Column | Type | Notes |
| --- | --- | --- |
| `room_id` | text | Room ID |
| `can_use_mic` | integer | Boolean flag |
| `can_use_camera` | integer | Boolean flag |
| `can_share_screen` | integer | Boolean flag |
| `can_chat` | integer | Boolean flag |
| `can_react` | integer | Boolean flag |
| `updated_at` | integer | Unix timestamp |

## In-Memory State

The signaling hub stores:

- Room map by room ID.
- Active peer map per room.
- Pending peer map per room.
- Peer WebSocket connection and send queue.
- Peer display name, user ID, host flag, and media mode.
- Room SFU session pointer.
- Runtime copies of durable participant permissions, admin permissions, room defaults, and active bans.

Live connection state is transient. Moderation state is rebuilt from SQLite when a room runtime is created.

## Indexes

Indexes are created for room events, room host lookup, room expiration, refresh token lookup, chat history lookup, file transfer history lookup, and active room ban lookup.
