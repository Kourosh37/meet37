# Caddy Reverse Proxy

Production meet37 deployments should be served over HTTPS. Caddy can terminate TLS and reverse proxy traffic to the frontend container.

## Network Requirement

The Caddy container and meet37 frontend container must share the same Docker network. In the default production setup, that network is:

```text
proxy
```

Create it once:

```bash
docker network create proxy
```

Both the Caddy compose file and `docker-compose.prod.yml` should reference this external network.

## Example Caddyfile

```text
meet.example.com {
    reverse_proxy meet37:3000
}
```

If you use manually mounted certificates:

```text
meet.example.com {
    tls /etc/caddy/certs/fullchain.pem /etc/caddy/certs/privkey.pem
    reverse_proxy meet37:3000
}
```

The target name `meet37` must match `FRONTEND_CONTAINER_NAME`.

## WebSocket

Caddy supports WebSocket proxying automatically for normal reverse proxy traffic. No special `/ws` block is required when all frontend traffic is proxied to the Next.js container.

The browser connects to:

```text
wss://meet.example.com/ws
```

Next.js rewrites `/ws` to `BACKEND_INTERNAL_URL`.

## HTTPS Requirement

Camera and microphone permission prompts require secure browser context in production. Screen sharing also requires secure context and browser support.

Use HTTPS for the public origin:

```text
PUBLIC_ORIGIN=https://meet.example.com
ALLOWED_ORIGINS=https://meet.example.com
```

## Common 502 Causes

- Caddy is not connected to the same Docker network as the frontend.
- `FRONTEND_CONTAINER_NAME` does not match the Caddy upstream name.
- Frontend container is unhealthy or not running.
- Frontend is listening on a different `FRONTEND_PORT`.
- `BACKEND_INTERNAL_URL` is missing and Next.js failed to start.
- Caddyfile still points to an old container name.

## Validation

From the server:

```bash
docker ps
docker network inspect proxy
curl -I https://meet.example.com
curl -i https://meet.example.com/api/settings
docker logs caddy --tail=100
docker logs meet37 --tail=100
docker logs meet37-backend --tail=100
```

If HTTPS works but media fails, debug media ports separately. Caddy does not forward WebRTC UDP media ports.
