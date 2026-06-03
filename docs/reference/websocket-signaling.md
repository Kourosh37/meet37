# WebSocket Signaling

WebSocket endpoint:

```text
/ws
```

Public browser URL is usually:

```text
wss://meet.example.com/ws
```

Messages use this envelope:

```json
{
  "type": "message-type",
  "to": "optional-target-peer-id",
  "payload": {}
}
```

The backend sets `from` to the sender peer ID.

## Connection Lifecycle

1. Browser opens `/ws`.
2. Backend creates a transient peer ID.
3. Client sends `join`.
4. Backend replies with `joined`, `waiting-approval`, or `error`.
5. Client and peers exchange signaling messages.
6. Client sends `leave` or disconnects.
7. Backend broadcasts `peer-left`.

## Outgoing Client Messages

### `join`

```json
{
  "type": "join",
  "payload": {
    "room_id": "...",
    "display_name": "Alice",
    "password": "optional",
    "host_token": "optional"
  }
}
```

### `leave`

```json
{
  "type": "leave"
}
```

### WebRTC P2P

Relayed to `to`:

- `offer`
- `answer`
- `ice-candidate`

Example:

```json
{
  "type": "offer",
  "to": "peer-id",
  "payload": {
    "sdp": "..."
  }
}
```

### SFU

- `sfu-offer`
- `sfu-ice-candidate`

The client sends SFU offers after receiving `sfu-switch` or after a local media track changes while an SFU session is active.

### Participant State

Broadcast to other peers:

```json
{
  "type": "media-state",
  "payload": {
    "audio_enabled": true,
    "audio_status": "ready",
    "video_enabled": false,
    "video_status": "off",
    "screen_sharing": true,
    "screen_share_status": "ready"
  }
}
```

Audio level:

```json
{
  "type": "audio-level",
  "payload": {
    "level": 0.42
  }
}
```

### Chat

```json
{
  "type": "chat",
  "payload": {
    "text": "Hello"
  }
}
```

### File Transfer

```json
{
  "type": "file-offer",
  "to": "peer-id",
  "payload": {
    "file_id": "...",
    "name": "file.txt",
    "size": 1000,
    "mime": "text/plain"
  }
}
```

```json
{
  "type": "file-answer",
  "to": "peer-id",
  "payload": {
    "file_id": "...",
    "accepted": true
  }
}
```

```json
{
  "type": "file-candidate",
  "to": "peer-id",
  "payload": {
    "file_id": "...",
    "candidate": "..."
  }
}
```

### Stats

```json
{
  "type": "stats",
  "payload": {
    "bitrate_kbps": 1200,
    "packet_loss_pct": 1.5,
    "rtt_ms": 80
  }
}
```

### Moderation

Host-only:

- `approve-peer`
- `reject-peer`
- `kick-peer`
- `mute-peer`

## Incoming Server Messages

### `joined`

```json
{
  "type": "joined",
  "payload": {
    "your_id": "...",
    "peers": [],
    "mode": "p2p",
    "is_host": true,
    "turn_servers": []
  }
}
```

### Join Flow

- `waiting-approval`
- `join-request`
- `join-rejected`
- `peer-joined`
- `peer-left`
- `room-closed`

### WebRTC

- `offer`
- `answer`
- `ice-candidate`

### SFU

- `sfu-switch`
- `sfu-answer`
- `sfu-ice-candidate`
- `sfu-renegotiate-needed`
- `peer-mode-changed`

Internal peer mode messages are operational state. Normal UI should not show P2P/SFU labels to users.

`sfu-switch` includes:

```json
{
  "type": "sfu-switch",
  "payload": {
    "session_id": "...",
    "turn_servers": []
  }
}
```

`sfu-renegotiate-needed` maps a relayed SFU track back to the original peer:

```json
{
  "type": "sfu-renegotiate-needed",
  "payload": {
    "session_id": "...",
    "track_id": "...",
    "stream_id": "...",
    "owner_id": "...",
    "mime_type": "video/vp8"
  }
}
```

The client should tolerate tracks arriving before this owner mapping. In that case, keep the track pending and publish it to the tile when `owner_id` is known.

### Chat And File

- `chat`
- `file-offer`
- `file-answer`
- `file-candidate`

### Moderation

- `mute-request`
- `kicked`

### Error

```json
{
  "type": "error",
  "payload": {
    "message": "room not found or expired"
  }
}
```

Important error messages include:

- `display_name required`
- `room not found or expired`
- `room is locked`
- `wrong room password`
- `That display name is already in this room. Choose another name.`
- `room is full`
- `host permission required`
