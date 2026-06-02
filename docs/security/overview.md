# Security Overview

meet37 security depends on correct authentication configuration, origin restrictions, HTTPS, secret management, network exposure, and browser permission behavior.

## Production Requirements

- Serve the public application over HTTPS.
- Set `ALLOWED_ORIGINS` to the exact public origin.
- Replace default `ADMIN_PASSWORD`.
- Replace default `JWT_SECRET`.
- Replace default `TURN_SECRET`.
- Keep `.env` out of git.
- Publish only required ports.
- Keep backend HTTP internal in production compose.
- Use an external reverse proxy network for frontend exposure.

## Authentication

The backend issues JWT access tokens and opaque refresh tokens.

- Access tokens are signed with `JWT_SECRET`.
- Refresh tokens are stored as SHA-256 hashes in SQLite.
- Admin login is validated against `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- Normal users are stored in the `users` table with bcrypt password hashes.
- Admin-only endpoints require a valid access token with `is_admin=true`.

## Authorization

- Room creation is open in public mode.
- Room creation requires authentication in private mode.
- User registration requires admin permission in private mode.
- Room deletion requires the room host or admin.
- Host moderation requires host identity through authenticated host ID or room host token.

## CORS And Origins

`ALLOWED_ORIGINS` controls CORS response behavior. In production, avoid `*`.

Recommended:

```text
ALLOWED_ORIGINS=https://meet.example.com
```

When the frontend uses `browser-origin`, the browser calls the same public origin and the reverse proxy/Next.js rewrites requests internally.

## WebSocket Security

`/ws` uses optional authentication. Authenticated clients may pass a bearer token through:

- `Authorization: Bearer <token>`
- `?token=<token>` query parameter

The WebSocket join message still validates room-specific requirements such as password, duplicate name, capacity, and join policy.

## Browser Permissions

Camera, microphone, and screen sharing require browser permission. In production, these APIs require secure context. Use HTTPS. Localhost is the development exception.

## Network Exposure

Production compose publishes:

- TURN/media TCP/UDP port.
- WebRTC UDP media range.

The backend HTTP port should stay internal to Docker. The frontend should be the only service attached to the reverse-proxy network.

## Secret Checklist

Generate:

```bash
openssl rand -base64 48
```

Set:

```text
ADMIN_PASSWORD=<strong-password>
JWT_SECRET=<random-secret>
TURN_SECRET=<random-secret>
```

Rotate immediately if `.env` is ever exposed.
