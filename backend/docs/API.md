# REST API

Base URL examples use local development:

```text
http://localhost:8080
```

All JSON endpoints use:

```http
Content-Type: application/json
```

Protected endpoints require:

```http
Authorization: Bearer <jwt>
```

## Error Format

Most application errors return:

```json
{
  "error": "message"
}
```

## Health

### `GET /health`

No authentication.

Response:

```text
ok
```

## Authentication

### `POST /api/auth/login`

Login as admin or registered user.

Request:

```json
{
  "username": "admin",
  "password": "secret"
}
```

Response:

```json
{
  "token": "access-jwt",
  "access_token": "access-jwt",
  "refresh_token": "refresh-token",
  "token_type": "Bearer",
  "expires_at": 1710000900,
  "refresh_expires_at": 1712592000,
  "user_id": "admin",
  "username": "admin",
  "is_admin": true
}
```

Status codes:

- `200`: login successful.
- `400`: invalid JSON.
- `401`: invalid credentials.
- `405`: method not allowed.

### `POST /api/auth/refresh`

Rotate a refresh token and receive a new access/refresh pair.

Request:

```json
{
  "refresh_token": "refresh-token"
}
```

Response format is the same as login.

Rules:

- Refresh tokens are stored hashed in SQLite.
- Refresh tokens are single-use. A successful refresh revokes the old token and returns a new one.
- Expired or revoked refresh tokens return `401`.

### `POST /api/auth/logout`

Revoke a refresh token.

Request:

```json
{
  "refresh_token": "refresh-token"
}
```

Response:

```text
204 No Content
```

### `POST /api/auth/register`

Admin-only compatibility endpoint for creating users. Prefer `POST /api/admin/users` in frontend admin panels.

Headers:

```http
Authorization: Bearer <admin-jwt>
```

Request:

```json
{
  "username": "user1",
  "password": "strong-password"
}
```

Response:

```json
{
  "id": "user-id",
  "username": "user1",
  "created_at": 1710000000
}
```

Status codes:

- `201`: created.
- `400`: invalid request or short username/password.
- `401`: missing/invalid token.
- `403`: token is not admin.
- `409`: username already exists.

## Rooms

### `POST /api/rooms`

Create a room.

Authentication:

- Public app mode: optional.
- Private app mode: required admin/user JWT.

Request:

```json
{
  "name": "Team Sync",
  "password": "",
  "join_policy": "approval",
  "max_peers": 50,
  "expires_in": 0
}
```

Fields:

- `name`: required room name.
- `password`: optional room password. Stored as bcrypt hash.
- `join_policy`: `open` or `approval`. Defaults to `open`.
- `max_peers`: optional. Defaults to `50`; maximum accepted value is `500`.
- `expires_in`: optional seconds from now. `0` means no expiry.

Response:

```json
{
  "room": {
    "id": "room-id",
    "name": "Team Sync",
    "host_id": "guest:uuid-or-user-id",
    "is_locked": false,
    "has_password": false,
    "join_policy": "approval",
    "max_peers": 50,
    "created_at": 1710000000,
    "expires_at": 1710003600
  },
  "host_token": "room-host-jwt"
}
```

Important frontend rule:

- Store `host_token` for the room creator session.
- Pass it in the WebSocket `join` payload when the creator enters the room.

Status codes:

- `201`: room created.
- `400`: invalid body or invalid `join_policy`.
- `403`: private mode requires login.

### `GET /api/rooms`

List active non-expired rooms.

Authentication:

- Optional.

Response:

```json
[
  {
    "id": "room-id",
    "name": "Team Sync",
    "host_id": "guest:...",
    "is_locked": false,
    "has_password": false,
    "join_policy": "open",
    "max_peers": 50,
    "created_at": 1710000000
  }
]
```

### `GET /api/rooms/{id}`

Get room metadata and live stats.

Authentication:

- Optional.

Response:

```json
{
  "room": {
    "id": "room-id",
    "name": "Team Sync",
    "host_id": "guest:...",
    "is_locked": false,
    "has_password": true,
    "join_policy": "approval",
    "max_peers": 50,
    "created_at": 1710000000
  },
  "live": {
    "active": true,
    "peer_count": 2,
    "pending_count": 1,
    "p2p_peers": 2,
    "sfu_peers": 0,
    "has_sfu_session": false
  }
}
```

Status codes:

- `200`: found.
- `404`: room not found.

### `DELETE /api/rooms/{id}`

Delete a room.

Authentication:

- Admin JWT, or logged-in owner JWT.

Note:

- Anonymous public-mode room creators currently moderate using `host_token` over WebSocket, but REST deletion requires a logged-in owner or admin.

Status codes:

- `204`: deleted.
- `403`: not owner/admin.
- `404`: not found.

## Admin Settings

### `GET /api/admin/settings`

Admin-only.

Response:

```json
{
  "app_mode": "public"
}
```

### `PUT /api/admin/settings`

Admin-only.

Request:

```json
{
  "app_mode": "private"
}
```

Allowed values:

- `public`
- `private`

Response:

```json
{
  "app_mode": "private"
}
```

## Admin Users

### `GET /api/admin/users`

Admin-only.

Response:

```json
[
  {
    "id": "user-id",
    "username": "frontuser",
    "created_at": 1710000000
  }
]
```

### `POST /api/admin/users`

Admin-only.

Request:

```json
{
  "username": "frontuser",
  "password": "password123"
}
```

Response:

```json
{
  "id": "user-id",
  "username": "frontuser",
  "created_at": 1710000000
}
```

Rules:

- Username must be at least 3 characters.
- Password must be at least 8 characters.
- Username is unique case-insensitively.

### `PUT /api/admin/users/{id}`

Admin-only.

Request:

```json
{
  "username": "new-name",
  "password": "new-password"
}
```

Both fields are optional, but at least one must be present.

Response:

```text
204 No Content
```

### `DELETE /api/admin/users/{id}`

Admin-only.

Response:

```text
204 No Content
```

## Admin Room Stats

### `GET /api/admin/rooms/{id}/stats`

Admin-only.

Response:

```json
{
  "active": true,
  "peer_count": 1,
  "pending_count": 0,
  "p2p_peers": 1,
  "sfu_peers": 0,
  "has_sfu_session": false
}
```
