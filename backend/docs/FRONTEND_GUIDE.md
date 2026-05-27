# Frontend Integration Guide

## Required Frontend Screens

Recommended screens:

- Login screen for admin/users.
- Admin panel.
- Room creation form.
- Shared room landing/pre-join screen.
- Meeting room screen.
- Waiting-for-approval screen.
- Host admission modal.

## Auth State

Store user/admin JWT after `POST /api/auth/login`.

Recommended storage:

- Short-term: memory or secure app state.
- If persistence is needed: consider secure HTTP-only cookie in a future backend update. Current API returns bearer tokens.

Admin panel should use:

```http
Authorization: Bearer <admin-jwt>
```

Private-mode room creation should use:

```http
Authorization: Bearer <user-or-admin-jwt>
```

## Room Creation Flow

1. User fills room form:
   - name
   - optional password
   - join policy: `open` or `approval`
   - max peers
   - expiry
2. Frontend calls `POST /api/rooms`.
3. Backend returns `room` and `host_token`.
4. Frontend stores `host_token` mapped to `room.id`.
5. Frontend navigates creator to `/meet/{room.id}`.
6. When opening WebSocket, include `host_token` in `join`.

Do not put `host_token` into the share link.

## Shared Link Join Flow

1. Visitor opens `/meet/{room_id}`.
2. Frontend calls `GET /api/rooms/{room_id}`.
3. If room not found, show unavailable/expired state.
4. If `has_password`, ask for room password.
5. Ask for display name.
6. Ask browser permissions:
   - camera/microphone with `navigator.mediaDevices.getUserMedia`
   - screen share later with `getDisplayMedia`
7. Open `/ws`.
8. Send `join`.
9. If `waiting-approval`, show waiting UI.
10. If `joined`, begin WebRTC peer negotiation.

## WebRTC Negotiation

When receiving `joined`, the payload includes existing peers. The new peer should usually initiate offers to existing peers.

Suggested approach:

1. Create local media stream.
2. Open WebSocket and join.
3. For every existing peer in `payload.peers`:
   - Create `RTCPeerConnection`.
   - Add local tracks.
   - Create data channel if needed.
   - Create offer.
   - Send `offer` to that peer.
4. When receiving `peer-joined`, existing peers should prepare to receive or create negotiation based on your chosen perfect-negotiation strategy.
5. Relay `answer` and `ice-candidate` through WebSocket.

## Recommended PeerConnection Config

Use `turn_servers` from `sfu-switch` when provided. Before that, the frontend can start with public STUN/TURN config from its own environment.

Example:

```js
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
});
```

After `sfu-switch`, product behavior depends on the media architecture chosen for the next phase. At minimum, frontend should surface degraded quality state and prepare to renegotiate using server-provided ICE servers.

## Chat

Two options:

- Use backend WebSocket `chat` messages for server-broadcast chat.
- Use WebRTC data channels for P2P chat.

Current backend supports WebSocket chat broadcast. This is simpler and persists no chat history.

## File Sharing

Recommended flow:

1. Sender chooses a file.
2. Sender creates a WebRTC data channel or uses an existing one.
3. Sender sends `file-offer` via backend WebSocket to target peer.
4. Receiver accepts with `file-answer`.
5. Sender streams file chunks over WebRTC data channel.
6. Progress is tracked entirely in frontend.

Backend does not store file bytes.

## Approval UI

Host:

- Listen for `join-request`.
- Show requester display name.
- Send `approve-peer` or `reject-peer`.

Guest:

- After `waiting-approval`, show waiting state.
- After `joined`, enter meeting.
- After `join-rejected`, show rejection state and close WebSocket.

## Moderation UI

Host controls:

- Mute audio: send `mute-peer` with `kind: "audio"`.
- Mute video: send `mute-peer` with `kind: "video"`.
- Kick: send `kick-peer`.

Participant behavior:

- On `mute-request`, disable the relevant local track and update UI.
- On `kicked`, leave meeting and show reason.

## Stats Reporting

Frontend should periodically read WebRTC stats and send:

```json
{
  "type": "stats",
  "payload": {
    "bitrate_kbps": 1200,
    "packet_loss_pct": 2.5,
    "rtt_ms": 80
  }
}
```

Recommended interval:

- Every 3-5 seconds while connected.

Avoid sending stats before the peer has enough data.

## Reconnection Guidance

Current backend does not restore peer identity after disconnect. On reconnect:

1. Open a new WebSocket.
2. Send `join` again.
3. Receive a new `peer_id`.
4. Rebuild peer connections.

Frontend should clean up old `RTCPeerConnection` instances when a WebSocket closes unexpectedly.

## Frontend Checklist

- Keep `host_token` private and local to the creator.
- Never include `host_token` in shared room URLs.
- Always send `display_name` in `join`.
- Handle `error` messages gracefully.
- Handle `waiting-approval`, `join-rejected`, `kicked`, and `room-closed`.
- Treat `mute-request` as a command to update local media state.
- Clean up media tracks on leave.
- Revoke object URLs created for received files.
- Show clear state for expired/not found/full/locked/password-protected rooms.

