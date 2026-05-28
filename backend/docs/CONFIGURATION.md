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
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | Access JWT lifetime. |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh session lifetime. |
| `RATE_LIMIT_RPS` | `20` | Per-IP refill rate for HTTP/WebSocket requests. |
| `RATE_LIMIT_BURST` | `60` | Per-IP burst capacity. |
| `MAX_BODY_BYTES` | `1048576` | Maximum HTTP request body size. |
| `SFU_RECORDING_ENABLED` | `false` | Enable raw RTP recording for SFU-forwarded tracks. |
| `SFU_RECORDING_PATH` | `/data/recordings` | Directory for raw `.rtp` recording files when recording is enabled. |
| `REDIS_URL` | empty | Optional Redis URL for shared signaling state. |
| `INSTANCE_ID` | hostname | Instance identity used in Redis signaling messages. |

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

ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=30
RATE_LIMIT_RPS=20
RATE_LIMIT_BURST=60
MAX_BODY_BYTES=1048576
SFU_RECORDING_ENABLED=false
SFU_RECORDING_PATH=/data/recordings
REDIS_URL=
INSTANCE_ID=
```

## Important Notes

- `.env` is ignored by git.
- `DEFAULT_APP_MODE` only affects first database initialization. After the settings row exists, admin changes are stored in SQLite.
- `DB_PATH` should stay under `/data` in Docker.
- `SFU_RECORDING_PATH` should stay under `/data` in Docker if recordings must persist.
- SFU recording files are raw RTP packet dumps, not browser-playable MP4/WebM files.
- For production, replace `JWT_SECRET`, `ADMIN_PASSWORD`, and `TURN_SECRET`.
- For production CORS, avoid `*`; set explicit frontend origins.
- Set `REDIS_URL` when running multiple backend instances.
