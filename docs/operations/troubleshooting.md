# Troubleshooting

## Caddy Returns 502

Check:

```bash
docker ps
docker network inspect proxy
docker logs caddy --tail=100
docker logs meet37 --tail=100
```

Common fixes:

- Attach frontend to the proxy network.
- Use the correct frontend container name in Caddyfile.
- Confirm frontend is listening on `FRONTEND_PORT`.
- Confirm `BACKEND_INTERNAL_URL` is set so Next.js can start.

## `/api/settings` Or `/api/rooms` Returns 404

If the frontend loads but `/api/*` returns 404, the request is probably not being rewritten to the backend.

Check:

```bash
docker logs meet37 --tail=100
grep BACKEND_INTERNAL_URL .env
curl -i http://meet37:3000/api/settings
```

Expected `BACKEND_INTERNAL_URL` in compose:

```text
BACKEND_INTERNAL_URL=http://backend:8080
```

## Cannot Join Room

Check browser console and backend logs.

Common causes:

- Wrong room password.
- Room expired or deleted.
- Room locked.
- Room full.
- Duplicate display name.
- Approval required and no host has approved.
- WebSocket `/ws` is not proxied.
- `ALLOWED_ORIGINS` does not include the public origin.

## Duplicate Name Keeps Joining

Expected behavior:

1. Backend sends an `error` signal.
2. Frontend stops the join attempt.
3. User remains in pre-join.
4. User changes display name and tries again.

If the UI continues into the room, inspect `useMeetingRoom`, `useSignalingMessages`, and join notification state.

## Camera Or Screen Share Stays Loading

Check:

- Browser permission prompt.
- HTTPS secure context.
- Whether local track was created.
- Whether `media-state` was broadcast.
- Whether WebRTC offer/answer completed.
- Whether ICE reached connected/completed.
- Whether UDP media ports are reachable on the server.

Server commands:

```bash
grep -E 'TURN_PUBLIC_IP|TURN_PORT|WEBRTC_UDP' .env
docker ps
ufw status verbose || true
ss -lunpt | grep -E '(:3478|:40000|:40100)' || true
```

## Audio Indicator Moves But No Audio Arrives

This means `audio-level` signaling is working, but actual audio media is not.

Check:

- Local microphone track exists and is enabled.
- Sender peer connection has an audio sender.
- Receiver got a remote audio track.
- `RemoteAudioPlayer` attached the stream.
- Browser autoplay was not blocking playback.
- ICE is connected.
- UDP media ports are reachable.

## Data Channel Does Not Open

Check:

- Peer connection ICE state.
- Data channel creation path.
- `DataChannelRegistry` registration.
- Channel `readyState`.
- Browser console for SCTP/data channel errors.

If media also fails, fix WebRTC connectivity first.

## File Transfer Stays Transferring

Check:

- Sender still has the local file bytes.
- Receiver accepted the offer.
- Data channel is open.
- Chunks are being sent.
- `bufferedAmount` is decreasing.
- Transfer timeout/error states are not swallowed.

Remember: the backend stores metadata only, not file bytes.

## Mobile Screen Share Does Not Work

Screen sharing cannot be forced on mobile browsers that do not implement `navigator.mediaDevices.getDisplayMedia`.

Expected behavior:

- If supported, show the normal screen-share flow.
- If unsupported, show a clear unsupported message.
- Do not imply server configuration can add screen capture support to the browser.

## VPN-Specific Join Problems

If the app works without VPN but hangs with VPN:

- Check whether the VPN blocks WebSocket.
- Check whether the VPN blocks UDP media ports.
- Check whether the VPN changes DNS/origin behavior.
- Test `/api/settings` and `/ws` from the VPN client.
- Use TURN/TCP where available, but still expect browser/network limitations.
