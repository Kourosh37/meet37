# API Reference

Base URL depends on deployment. In browser-origin deployments, public API paths are called from the same origin that serves the frontend.

Error response shape for JSON handler errors:

```json
{
  "error": "message"
}
```

Some middleware errors use plain HTTP text responses.

## Health

### `GET /health`

Returns:

```text
ok
```

## Public Settings

### `GET /api/settings`

Returns:

```json
{
  "app_mode": "public"
}
```

`app_mode` is `public` or `private`.

## Auth

### `POST /api/auth/login`

Request:

```json
{
  "username": "admin",
  "password": "password"
}
```

Returns:

```json
{
  "token": "...",
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_at": 1760000000,
  "refresh_expires_at": 1760000000,
  "user_id": "admin",
  "username": "admin",
  "is_admin": true
}
```

### `POST /api/auth/refresh`

Request:

```json
{
  "refresh_token": "..."
}
```

Returns the same shape as login and revokes the old refresh token.

### `POST /api/auth/logout`

Request:

```json
{
  "refresh_token": "..."
}
```

Returns `204 No Content`.

### `POST /api/auth/register`

Protected admin route in current server routing.

Request:

```json
{
  "username": "user",
  "password": "password123"
}
```

Returns:

```json
{
  "id": "...",
  "username": "user",
  "created_at": 1760000000
}
```

## Rooms

### `GET /api/rooms`

Lists non-expired rooms.

Returns:

```json
[
  {
    "id": "abc-def-ghi",
    "name": "Daily",
    "host_id": "...",
    "is_locked": false,
    "has_password": false,
    "join_policy": "open",
    "max_peers": 50,
    "created_at": 1760000000
  }
]
```

### `POST /api/rooms`

Optional auth route. In private mode, authentication is required.

Created room IDs use the `aaa-aaa-aaa` format with lowercase English letters.

Request:

```json
{
  "name": "Daily",
  "password": "optional",
  "join_policy": "open",
  "max_peers": 50,
  "expires_in": 3600
}
```

Returns `201 Created`:

```json
{
  "room": {
    "id": "abc-def-ghi",
    "name": "Daily",
    "host_id": "...",
    "is_locked": false,
    "has_password": true,
    "join_policy": "open",
    "max_peers": 50,
    "created_at": 1760000000,
    "expires_at": 1760003600
  },
  "host_token": "..."
}
```

### `GET /api/rooms/{roomId}`

`roomId` uses the `aaa-aaa-aaa` format with lowercase English letters.

Returns:

```json
{
  "room": {
    "id": "abc-def-ghi",
    "name": "Daily",
    "host_id": "...",
    "is_locked": false,
    "has_password": false,
    "join_policy": "open",
    "max_peers": 50,
    "created_at": 1760000000
  },
  "live": {
    "active": true,
    "peer_count": 2,
    "pending_count": 0,
    "sfu_peers": 2,
    "has_sfu_session": true
  }
}
```

### `DELETE /api/rooms/{roomId}`

Requires host or admin.

Returns `204 No Content`.

### `GET /api/rooms/{roomId}/chat`

Returns up to 500 chat messages ordered by timestamp and ID.

### `GET /api/rooms/{roomId}/files`

Returns up to 500 file-transfer metadata records ordered by timestamp and ID.
Pass `peer_id` to return only transfers targeted at the current meeting peer:

```text
GET /api/rooms/{roomId}/files?peer_id={peerId}
```

## Admin

All admin endpoints require a bearer access token with `is_admin=true`.

### `GET /api/admin/settings`

Returns:

```json
{
  "app_mode": "public"
}
```

### `PUT /api/admin/settings`

Request:

```json
{
  "app_mode": "private"
}
```

Returns updated settings.

### `GET /api/admin/users`

Returns user list.

### `POST /api/admin/users`

Creates a user.

### `PUT /api/admin/users/{userId}`

Updates username and/or password.

### `DELETE /api/admin/users/{userId}`

Deletes a user.

### `GET /api/admin/rooms/{roomId}/stats`

Returns live room stats.

### `GET /api/admin/sfu/stats`

Returns SFU manager stats:

```json
{
  "session_count": 1,
  "sessions": {
    "room-id": {
      "peer_count": 2,
      "track_count": 2,
      "packets_relayed": 100,
      "bytes_relayed": 2048,
      "recordings": 0
    }
  }
}
```
