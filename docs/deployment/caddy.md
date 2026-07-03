# Caddy Reverse Proxy

Production compose runs Caddy as part of the meet37 stack. No separate proxy project or external Docker network is required.

## Files

Expected paths on the server:

```text
/opt/meet37/caddy/Caddyfile
/opt/meet37/caddy/certs/fullchain.pem
/opt/meet37/caddy/certs/privkey.pem
```

Default `Caddyfile`:

```text
{$PUBLIC_DOMAIN} {
    tls {$CADDY_TLS_CERT} {$CADDY_TLS_KEY}
    encode zstd gzip
    reverse_proxy frontend:{$FRONTEND_PORT}
}
```

The certificate variables default to:

```text
CADDY_TLS_CERT=/etc/caddy/certs/fullchain.pem
CADDY_TLS_KEY=/etc/caddy/certs/privkey.pem
```

## Environment

Use the exact HTTPS origin:

```text
PUBLIC_DOMAIN=meet.example.com
PUBLIC_ORIGIN=https://meet.example.com
ALLOWED_ORIGINS=https://meet.example.com
NEXT_PUBLIC_API_BASE_URL=browser-origin
NEXT_PUBLIC_WS_URL=browser-origin
```

The browser connects to `/api` and `/ws` on the same origin. Next.js rewrites those requests to the backend over the internal Docker network.

## Validation

```bash
cd /opt/meet37
docker compose --env-file .env -f docker-compose.prod.yml logs --tail=100 caddy
curl -I https://meet.example.com
curl -i https://meet.example.com/api/settings
```

If HTTPS works but media fails, debug TURN/SFU UDP ports separately. Caddy does not proxy WebRTC UDP media.
