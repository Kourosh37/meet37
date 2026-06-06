# Network Security

## Public Entry Points

Production users should only access meet37 through HTTPS:

```text
https://meet.example.com
```

Caddy or another reverse proxy terminates TLS and proxies traffic to the frontend container.

## Internal HTTP

The backend listens on `PORT`, default `8080`. In production compose this port is not published on the host. The frontend reaches it through:

```text
BACKEND_INTERNAL_URL=http://backend:8080
```

## WebSocket

Public WebSocket:

```text
wss://meet.example.com/ws
```

Frontend rewrite target:

```text
http://backend:8080/ws
```

## Media Ports

Media ports must be reachable from browser clients:

```text
TURN_HOST_PORT/TCP
TURN_HOST_PORT/UDP
TURN_RELAY_PORT_MIN-TURN_RELAY_PORT_MAX/UDP
TURN_RELAY_PORT_MIN-TURN_RELAY_PORT_MAX/TCP
WEBRTC_UDP_HOST_PORT_MIN-WEBRTC_UDP_HOST_PORT_MAX/UDP
```

Example firewall:

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 43000:43100/tcp
ufw allow 43000:43100/udp
ufw allow 40000:40100/udp
ufw reload
```

Use the actual values from `.env`.

## Docker Networks

Production compose uses:

- `DOCKER_INTERNAL_NETWORK`: private network between backend and frontend.
- `DOCKER_PROXY_NETWORK`: external network shared by frontend and reverse proxy.

The backend and coturn services should not join the proxy network unless there is a specific operational reason. The frontend joins the proxy network so Caddy can reach it.

## NAT And VPN

If clients are behind restrictive NAT, VPN, or corporate networks:

- UDP may be blocked.
- WebSocket may be inspected or blocked.
- Public IP candidates may be unreachable.
- Screen sharing support may differ by browser.

Always test:

```bash
curl -i https://meet.example.com/api/settings
```

Then verify browser WebSocket and WebRTC ICE state in developer tools.
