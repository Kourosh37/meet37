# Authentication And Access

## Login

Endpoint:

```text
POST /api/auth/login
```

Request:

```json
{
  "username": "admin",
  "password": "password"
}
```

Response includes:

- `access_token`
- `refresh_token`
- `token_type`
- `expires_at`
- `refresh_expires_at`
- `user_id`
- `username`
- `is_admin`

The admin user is configured through environment variables. Normal users are loaded from SQLite.

## Refresh

Endpoint:

```text
POST /api/auth/refresh
```

Refresh tokens are rotated. A successful refresh revokes the previous refresh session and creates a new one.

## Logout

Endpoint:

```text
POST /api/auth/logout
```

The backend revokes the refresh token hash and returns `204 No Content`.

## Registration

Endpoint:

```text
POST /api/auth/register
```

In current routing, registration is protected by auth and admin middleware. In private mode, admin-only registration is required.

Validation:

- Username length must be at least 3.
- Password length must be at least 8.
- Username must be unique case-insensitively.

## Room Access

Room join is not a plain HTTP authorization decision. It happens over WebSocket:

1. Client connects to `/ws`.
2. Client sends `join`.
3. Backend validates room state.
4. Backend sends `joined`, `waiting-approval`, or `error`.

Join checks:

- Room exists and is not expired.
- Room is not locked.
- Password matches if a password is configured.
- Display name is not empty.
- Display name is not already active or pending in the room.
- Room is not full.
- Host approval is satisfied when `join_policy=approval`.

## Host Access

A room creator receives `host_token` from `POST /api/rooms`. The token proves host access for that room. Authenticated users also count as host when their user ID matches the room `host_id`.

## Admin Access

Admin-only routes require a bearer access token with `is_admin=true`.

Admin routes:

- `/api/admin/settings`
- `/api/admin/users`
- `/api/admin/users/{userId}`
- `/api/admin/rooms/{roomId}/stats`
- `/api/admin/sfu/stats`
