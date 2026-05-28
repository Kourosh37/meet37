# WebSocket Protocol

Endpoint:

```text
GET /ws
```

Optional authenticated connection:

```text
GET /ws?token=<jwt>
```

Authentication is optional because shared room links are public attendance flows. If a user/admin token is present, the backend attaches that identity to the peer.

## Envelope

Every WebSocket message is JSON:

```json
{
  "type": "message-type",
  "from": "sender-peer-id",
  "to": "target-peer-id",
  "payload": {}
}
```

Client-sent messages usually omit `from`. The backend sets it to the sender peer ID.

## Connection Lifecycle

1. Frontend opens `/ws`.
2. Frontend sends `join`.
3. Backend replies with one of:
   - `joined`
   - `waiting-approval`
   - `error`
4. Frontend starts WebRTC offer/answer/ICE exchange using peer IDs.
5. Frontend periodically sends `stats`.
6. Frontend handles moderation and fallback events.

## Join

### Open Room Join

Client:

```json
{
  "type": "join",
  "payload": {
    "room_id": "room-id",
    "display_name": "Sara",
    "password": ""
  }
}
```

Backend:

```json
{
  "type": "joined",
  "payload": {
    "your_id": "peer-id",
    "peers": [
      {
        "id": "other-peer-id",
        "user_id": "optional-user-id",
        "display_name": "Ali",
        "mode": "p2p",
        "is_host": true
      }
    ],
    "mode": "p2p",
    "is_host": false
  }
}
```

### Host Join

The room creator passes `host_token` from `POST /api/rooms`:

```json
{
  "type": "join",
  "payload": {
    "room_id": "room-id",
    "display_name": "Host",
    "host_token": "host-token"
  }
}
```

Backend marks the peer as host when:

- The `host_token` is valid for that room, or
- The authenticated user ID matches the stored `host_id`.

### Approval Room Join

Guest:

```json
{
  "type": "join",
  "payload": {
    "room_id": "room-id",
    "display_name": "Guest"
  }
}
```

Guest receives:

```json
{
  "type": "waiting-approval",
  "payload": {
    "your_id": "pending-peer-id"
  }
}
```

Host receives:

```json
{
  "type": "join-request",
  "from": "pending-peer-id",
  "payload": {
    "peer_id": "pending-peer-id",
    "display_name": "Guest"
  }
}
```

Host approves:

```json
{
  "type": "approve-peer",
  "payload": {
    "peer_id": "pending-peer-id"
  }
}
```

Host rejects:

```json
{
  "type": "reject-peer",
  "payload": {
    "peer_id": "pending-peer-id",
    "reason": "Not recognized"
  }
}
```

Rejected guest receives:

```json
{
  "type": "join-rejected",
  "payload": {
    "reason": "Not recognized"
  }
}
```

## Peer Presence Events

New peer notification:

```json
{
  "type": "peer-joined",
  "from": "peer-id",
  "payload": {
    "peer_id": "peer-id",
    "display_name": "Sara",
    "is_host": false
  }
}
```

Peer leave notification:

```json
{
  "type": "peer-left",
  "from": "peer-id",
  "payload": {
    "peer_id": "peer-id"
  }
}
```

Room closed:

```json
{
  "type": "room-closed"
}
```

## WebRTC Signaling Relay

The backend relays these message types to the peer in `to`:

- `offer`
- `answer`
- `ice-candidate`

Offer example:

```json
{
  "type": "offer",
  "to": "target-peer-id",
  "payload": {
    "sdp": "..."
  }
}
```

ICE example:

```json
{
  "type": "ice-candidate",
  "to": "target-peer-id",
  "payload": {
    "candidate": "...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

The backend does not inspect SDP/ICE payloads. It forwards them as JSON.

## SFU Media Relay Signaling

When a client receives `sfu-switch`, it should create a server-facing `RTCPeerConnection` and send an SFU offer.

Client:

```json
{
  "type": "sfu-offer",
  "payload": {
    "sdp": "client-offer-sdp"
  }
}
```

Backend:

```json
{
  "type": "sfu-answer",
  "payload": {
    "session_id": "session-id",
    "sdp": "server-answer-sdp"
  }
}
```

Client sends SFU ICE candidates:

```json
{
  "type": "sfu-ice-candidate",
  "payload": {
    "candidate": "...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

Backend sends SFU ICE candidates with the same `sfu-ice-candidate` type.

When the SFU receives a new remote track and adds it to existing subscribers, the affected client receives:

```json
{
  "type": "sfu-renegotiate-needed",
  "payload": {
    "session_id": "session-id",
    "track_id": "audio",
    "stream_id": "stream",
    "owner_id": "publisher-peer-id",
    "mime_type": "audio/opus"
  }
}
```

The frontend should create and send a fresh `sfu-offer` so the new SFU sender track can appear in the next answer.

## Chat

Client:

```json
{
  "type": "chat",
  "payload": {
    "text": "hello"
  }
}
```

Backend broadcasts to all other approved peers in the room.

## File Transfer Signaling

The backend relays these file-related messages to `to`:

- `file-offer`
- `file-answer`
- `file-candidate`

Recommended file offer payload:

```json
{
  "type": "file-offer",
  "to": "target-peer-id",
  "payload": {
    "file_id": "uuid",
    "name": "report.pdf",
    "size": 123456,
    "mime": "application/pdf"
  }
}
```

File bytes should move through WebRTC data channels or another frontend-selected transport. The backend currently coordinates metadata only.

## Quality Stats

Client:

```json
{
  "type": "stats",
  "payload": {
    "bitrate_kbps": 900,
    "packet_loss_pct": 10,
    "rtt_ms": 350
  }
}
```

Backend may reply:

```json
{
  "type": "sfu-switch",
  "payload": {
    "session_id": "session-id",
    "turn_servers": [
      {
        "urls": [
          "turn:your.server.public.ip:3478?transport=udp",
          "turn:your.server.public.ip:3478?transport=tcp"
        ],
        "username": "expiry:peer-id",
        "credential": "hmac-secret"
      }
    ]
  }
}
```

Other peers receive:

```json
{
  "type": "peer-mode-changed",
  "from": "peer-id",
  "payload": {
    "peer_id": "peer-id",
    "mode": "sfu"
  }
}
```

## Host Moderation

### Mute

Host sends:

```json
{
  "type": "mute-peer",
  "payload": {
    "peer_id": "target-peer-id",
    "kind": "audio"
  }
}
```

Target receives:

```json
{
  "type": "mute-request",
  "from": "host-peer-id",
  "payload": {
    "kind": "audio"
  }
}
```

`kind` may be `audio`, `video`, or a frontend-defined value. The frontend must enforce muting locally.

### Kick

Host sends:

```json
{
  "type": "kick-peer",
  "payload": {
    "peer_id": "target-peer-id",
    "reason": "Removed by host"
  }
}
```

Target receives:

```json
{
  "type": "kicked",
  "payload": {
    "reason": "Removed by host"
  }
}
```

Other peers receive `peer-left`.

## Errors

Error example:

```json
{
  "type": "error",
  "payload": {
    "message": "display_name required"
  }
}
```

Common errors:

- `invalid message`
- `unknown message type`
- `invalid join payload`
- `display_name required`
- `room not found or expired`
- `room is locked`
- `wrong room password`
- `room is full`
- `host permission required`
- `peer not pending`
- `peer not found`
