# Security Notes

## Secrets

Do not commit `.env`.

Required production changes:

- Replace `ADMIN_PASSWORD`.
- Replace `JWT_SECRET`.
- Replace `TURN_SECRET`.
- Restrict `ALLOWED_ORIGINS`.

## Passwords

- User passwords are stored with bcrypt.
- Room passwords are stored with bcrypt.
- Admin password is read from environment and is not stored in SQLite.

## JWT

- JWTs are signed with HMAC SHA-256.
- JWT parsing rejects unexpected signing methods.
- User/admin tokens currently expire after 24 hours.
- Room `host_token` is JWT-signed and includes a room-scoped secret. The backend validates that secret against a bcrypt hash in SQLite.

## Host Token Handling

Frontend must:

- Store `host_token` only for the creator session.
- Never include `host_token` in shared links.
- Never expose `host_token` to other participants.

If a host token leaks, someone can moderate that room.

## CORS

Development may use:

```env
ALLOWED_ORIGINS=*
```

Production should use explicit origins:

```env
ALLOWED_ORIGINS=https://app.example.com
```

## Current Gaps To Address Before Large Public Launch

- Rate limiting for login, room creation, and WebSocket joins.
- Request body size limits for REST endpoints.
- Stronger audit logging.
- Refresh-token/session revocation strategy.
- CSRF strategy if browser cookies are introduced.
- Abuse controls for public room creation.
- Real TURN server process and/or SFU media relay.
- Horizontal scaling strategy for signaling state.

