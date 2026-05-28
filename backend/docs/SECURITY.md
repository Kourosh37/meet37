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
- Access tokens are short-lived and configurable with `ACCESS_TOKEN_TTL_MINUTES`.
- Refresh tokens are random opaque tokens, stored as SHA-256 hashes, rotated on use, and revoked on logout.
- Room `host_token` is JWT-signed and includes a room-scoped secret. The backend validates that secret against a bcrypt hash in SQLite.
- Per-IP rate limiting is enabled globally.
- HTTP request bodies are capped with `MAX_BODY_BYTES`.
- Redis signaling ignores events from the same `INSTANCE_ID` to avoid command echo loops.

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

- Stronger audit logging.
- CSRF strategy if browser cookies are introduced.
- More granular abuse controls for public room creation, such as per-account quotas and CAPTCHA.
- Production TURN server process hardening and monitoring.
- Dedicated distributed SFU media plane if large rooms must span many backend instances.
- Virus scanning or object-storage policy if a future server-side file upload fallback is added.
