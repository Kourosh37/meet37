# Meet Backend

Go backend for a WebRTC-first meeting app. The backend owns authentication, admin settings, room creation policy, public room links, room admission control, live signaling, chat signaling, file-transfer signaling, and host moderation commands.

The actual camera, microphone, screen share, and file bytes are transferred by browser WebRTC. This backend exchanges signaling messages and tells clients when to fall back from P2P toward server-assisted transport.

## Admin And Access Rules

- Admin username/password are loaded only from `.env`: `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
- Admin logs in with `POST /api/auth/login` and receives a JWT.
- Admin can switch the whole site between:
  - `public`: anyone can create a room without logging in.
  - `private`: only the admin or users created by admin can create rooms.
- In `private` mode, admin manages the allowed users list through `/api/admin/users`.
- Shared room links are always joinable without account login. Joining a room only needs a display name and the room checks described below.

## Room Rules

Every room has a `join_policy`:

- `open`: anyone with the room link can join after sending a display name.
- `approval`: anyone with the room link can request to join, but the room host must approve them.

Room creation returns a `host_token`. The frontend must store it for the creator session and pass it when the creator joins the WebSocket room. The host token lets the creator approve/reject pending users, mute users, and kick users.

## REST API

### Health

`GET /health`

Returns `ok`.

### Login

`POST /api/auth/login`

```json
{
  "username": "admin",
  "password": "secret"
}
```

Returns:

```json
{
  "token": "jwt",
  "user_id": "admin",
  "username": "admin",
  "is_admin": true
}
```

### Create Room

`POST /api/rooms`

Auth:
- Public mode: no token required.
- Private mode: `Authorization: Bearer <jwt>` required.

Body:

```json
{
  "name": "Daily meeting",
  "password": "",
  "join_policy": "open",
  "max_peers": 50,
  "expires_in": 0
}
```

`join_policy` can be `open` or `approval`.

Returns:

```json
{
  "room": {
    "id": "room-id",
    "name": "Daily meeting",
    "host_id": "guest-or-user-id",
    "is_locked": false,
    "has_password": false,
    "join_policy": "open",
    "max_peers": 50,
    "created_at": 1710000000
  },
  "host_token": "jwt-for-room-host"
}
```

### Get Room

`GET /api/rooms/{id}`

Public. Used by the frontend before joining a shared room link.

### List Rooms

`GET /api/rooms`

Public. Returns active non-expired rooms.

### Delete Room

`DELETE /api/rooms/{id}`

Requires logged-in room owner or admin JWT.

### Admin Settings

`GET /api/admin/settings`

`PUT /api/admin/settings`

```json
{
  "app_mode": "private"
}
```

Requires admin JWT.

### Admin Users CRUD

`GET /api/admin/users`

`POST /api/admin/users`

```json
{
  "username": "reza",
  "password": "strong-password"
}
```

`PUT /api/admin/users/{id}`

```json
{
  "username": "new-name",
  "password": "new-strong-password"
}
```

`DELETE /api/admin/users/{id}`

All require admin JWT.

### Admin Room Stats

`GET /api/admin/rooms/{id}/stats`

Requires admin JWT.

## WebSocket

Connect:

`GET /ws`

Optional query:
- `?token=<user-jwt>` if the joining browser is a logged-in private-mode user or admin.

After connecting, the client must send `join`.

### Join Open Room

```json
{
  "type": "join",
  "payload": {
    "room_id": "room-id",
    "display_name": "Ali",
    "password": ""
  }
}
```

### Join As Host

The room creator should include `host_token`:

```json
{
  "type": "join",
  "payload": {
    "room_id": "room-id",
    "display_name": "Host",
    "host_token": "host-token-from-create-room"
  }
}
```

Successful join response:

```json
{
  "type": "joined",
  "payload": {
    "your_id": "peer-id",
    "peers": [],
    "mode": "p2p",
    "is_host": true
  }
}
```

### Approval Flow

For `join_policy: "approval"`, non-host clients receive:

```json
{
  "type": "waiting-approval",
  "payload": {
    "your_id": "peer-id"
  }
}
```

Hosts receive:

```json
{
  "type": "join-request",
  "from": "peer-id",
  "payload": {
    "peer_id": "peer-id",
    "display_name": "Sara"
  }
}
```

Approve:

```json
{
  "type": "approve-peer",
  "payload": {
    "peer_id": "peer-id"
  }
}
```

Reject:

```json
{
  "type": "reject-peer",
  "payload": {
    "peer_id": "peer-id",
    "reason": "not allowed"
  }
}
```

### Host Moderation

Kick:

```json
{
  "type": "kick-peer",
  "payload": {
    "peer_id": "peer-id",
    "reason": "removed by host"
  }
}
```

Mute:

```json
{
  "type": "mute-peer",
  "payload": {
    "peer_id": "peer-id",
    "kind": "audio"
  }
}
```

The target receives `mute-request`. The frontend must stop or disable the requested media track.

### P2P Signaling

The backend relays these messages to `to`:

- `offer`
- `answer`
- `ice-candidate`
- `file-offer`
- `file-answer`
- `file-candidate`

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

### Chat

```json
{
  "type": "chat",
  "payload": {
    "text": "hello"
  }
}
```

Broadcasts to everyone else in the room.

### Quality Stats And SFU Fallback

Clients should periodically send:

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

If quality is below configured thresholds, the peer receives:

```json
{
  "type": "sfu-switch",
  "payload": {
    "session_id": "session-id",
    "turn_servers": []
  }
}
```

## Docker

```bash
cp .env.example .env
docker compose up --build
```
