# Configuration

Configuration is read from environment variables.

## Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | HTTP/WebSocket listen port. |
| `ENV` | `production` | Use non-production for console-friendly logging. |
| `ADMIN_USERNAME` | `admin` | Admin login username. |
| `ADMIN_PASSWORD` | `changeme` | Admin login password. Must be changed. |
| `JWT_SECRET` | `change-me-in-production` | HMAC secret for JWT signing. Must be long and random. |
| `DEFAULT_APP_MODE` | `public` | Initial mode inserted into DB on first migration. |
| `TURN_PUBLIC_IP` | `127.0.0.1` | Public TURN/SFU host advertised to clients. |
| `TURN_PORT` | `3478` | TURN port advertised to clients. |
| `TURN_SECRET` | `turnsecret` | Secret used to generate time-bound TURN-style credentials. |
| `DB_PATH` | `/data/meet.db` | SQLite database path. |
| `SFU_FALLBACK_THRESHOLD_KBPS` | `1500` | Bitrate threshold for fallback trigger. |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins or `*`. |

## Example `.env`

```env
PORT=8080
ENV=production

ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_me_strong_password
JWT_SECRET=replace_with_a_long_random_secret

DEFAULT_APP_MODE=public

TURN_PUBLIC_IP=your.server.public.ip
TURN_PORT=3478
TURN_SECRET=another_random_secret_for_turn

DB_PATH=/data/meet.db
SFU_FALLBACK_THRESHOLD_KBPS=1500
ALLOWED_ORIGINS=*
```

## Important Notes

- `.env` is ignored by git.
- `DEFAULT_APP_MODE` only affects first database initialization. After the settings row exists, admin changes are stored in SQLite.
- `DB_PATH` should stay under `/data` in Docker.
- For production, replace `JWT_SECRET`, `ADMIN_PASSWORD`, and `TURN_SECRET`.
- For production CORS, avoid `*`; set explicit frontend origins.

