# Business Logic

## Roles

### Admin

The admin is not stored in the database. Admin credentials come from environment variables:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Admin abilities:

- Login and receive an admin JWT.
- Switch the app between `public` and `private`.
- Create, list, update, and delete allowed private-mode users.
- View live room stats.

### Registered User

Registered users are created by the admin and stored in SQLite with bcrypt password hashes.

User abilities:

- Login and receive a user JWT.
- Create rooms when the app is in `private` mode.
- Create rooms when the app is in `public` mode, although auth is not required there.

### Anonymous Visitor

Anonymous visitors have no account token.

Visitor abilities:

- Create rooms only when the app is in `public` mode.
- Join shared room links in both public and private modes.
- Provide a `display_name` before entering a room.

### Room Host

The room creator becomes the host. For anonymous public-mode creators, there is no account identity, so the backend returns a room-scoped `host_token`.

Host abilities:

- Join the room as host using `host_token`.
- Receive join requests for approval-mode rooms.
- Approve or reject pending participants.
- Ask participants to mute audio/video.
- Kick participants from the room.

## App Mode

The app has one global setting: `app_mode`.

### Public Mode

Rules:

- Anyone can create a room.
- No JWT is required for `POST /api/rooms`.
- Room creation still returns `host_token`.
- Shared room links are joinable by anyone who passes room-level checks.

### Private Mode

Rules:

- Only admin or registered users can create rooms.
- `POST /api/rooms` requires `Authorization: Bearer <jwt>`.
- Shared room links remain joinable by anyone.
- The private-mode restriction applies to room creation, not room attendance.

## Room Join Policy

Each room has a `join_policy`.

### Open

`join_policy: "open"`

Anyone with the room link can join after:

- Room exists.
- Room is not expired.
- Room is not locked.
- Room password is valid if configured.
- Room capacity is not exceeded.
- `display_name` is present.

### Approval

`join_policy: "approval"`

Non-host participants enter a pending state:

1. Guest sends WebSocket `join`.
2. Backend replies to guest with `waiting-approval`.
3. Backend sends `join-request` to all connected hosts in the room.
4. Host sends `approve-peer` or `reject-peer`.
5. Approved guest receives `joined`.
6. Rejected guest receives `join-rejected`.

Hosts bypass approval for their own room.

## Shared Links

The frontend can expose room links such as:

```text
https://app.example.com/meet/{room_id}
```

Backend requirements for link joining:

- The frontend should call `GET /api/rooms/{room_id}`.
- The participant must choose a display name.
- The participant may need a room password if the room was created with one.
- The participant opens WebSocket `/ws`.
- No app account is required for attendance.

## Display Names

Every WebSocket join requires:

```json
{
  "display_name": "Participant name"
}
```

Display names are runtime state and are not persisted as users.

## Host Moderation

### Mute

Host sends `mute-peer`. Backend validates host status and sends `mute-request` to the target peer.

The backend cannot directly mute browser media tracks. The frontend must handle `mute-request` by disabling or stopping the relevant local track.

### Kick

Host sends `kick-peer`. Backend validates host status, sends `kicked` to the target, removes the peer from room state, and notifies others with `peer-left`.

## Quality Fallback

Clients periodically send `stats` containing bitrate, packet loss, and RTT.

Backend triggers `sfu-switch` when:

- `bitrate_kbps` is greater than zero and below `SFU_FALLBACK_THRESHOLD_KBPS`.
- `packet_loss_pct` is above the server threshold.
- `rtt_ms` is above the server threshold.

Current fallback behavior:

- Backend creates/returns a fallback session ID.
- Backend returns TURN-style credentials.
- Frontend can negotiate a Pion SFU PeerConnection with `sfu-offer`.
- Backend returns `sfu-answer`, exchanges `sfu-ice-candidate`, receives RTP tracks, and forwards those tracks to other SFU peers.
- Existing SFU peers may receive `sfu-renegotiate-needed` when a new forwarded track is available.

The SFU relay is intentionally minimal: it forwards RTP tracks but does not yet implement recording, simulcast/SVC layer policy, server-side muting, or a distributed media plane.
