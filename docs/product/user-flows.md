# User Flows

## First Visit

1. The user opens the public frontend origin.
2. The frontend loads the main layout and requests public settings from `/api/settings`.
3. If the app is in public mode, room creation and joining are available without login.
4. If the app is in private mode, authenticated-only flows are guarded by the auth UI.

## Create A Room

1. The user opens the room creation page.
2. The user enters a room name and optional room settings.
3. The frontend sends `POST /api/rooms`.
4. The backend validates create permission from current app mode.
5. The backend creates a SQLite room row, hashes the optional room password, generates a host secret, stores a host secret hash, and returns the room plus `host_token`.
6. The frontend stores or carries the host token into the meeting route so the creator can join as host.

## Join A Room

1. The user opens `/meet/{roomId}`.
2. The frontend loads room metadata from `/api/rooms/{roomId}`.
3. The user enters a display name and optional password.
4. The frontend opens `/ws`.
5. The frontend sends a WebSocket `join` message.
6. The backend validates the room, password, lock state, duplicate name, capacity, and join policy.
7. If valid and open, the backend sends `joined`.
8. If approval is required, the backend sends `waiting-approval` to the joining user and `join-request` to hosts.
9. Existing peers receive `peer-joined`.
10. The frontend starts WebRTC negotiation with peers returned in `joined`.

## Duplicate Display Name

1. The user attempts to join with a display name already active or pending in the room.
2. The backend sends an `error` signal with a duplicate-name message.
3. The frontend must stop the join attempt and keep the user in pre-join until a different name is entered.

## Camera

1. The user toggles camera on.
2. The frontend requests `getUserMedia` with video constraints and selected device preferences.
3. Local media state moves through `starting` to `ready` or `error`.
4. The frontend publishes `media-state`.
5. WebRTC tracks are added/replaced for peers.
6. Remote participants show loading until the video track arrives and starts rendering.

## Microphone

1. The user toggles microphone on.
2. The frontend requests or reuses an audio track.
3. Audio constraints are configured for higher call quality and browser processing.
4. The frontend publishes `media-state`.
5. Remote audio tracks play through hidden audio elements.
6. Audio-level signals are broadcast so remote participants can see speaking indicators.

## Screen Sharing

1. The user toggles screen sharing.
2. The frontend calls `navigator.mediaDevices.getDisplayMedia` when available.
3. Camera is stopped if the UI flow requires screen share and camera to be mutually exclusive.
4. The frontend publishes `media-state`.
5. WebRTC video sender tracks are replaced with the display track.
6. Remote participants show screen-share loading until the track renders.
7. When the display track ends, the frontend clears screen-share state and notifies peers.

## File Transfer

1. The sender selects a file.
2. The sender creates or reuses a data channel to each recipient.
3. The sender waits for the channel to be registered and open.
4. The sender sends a `file-offer`.
5. The receiver accepts or rejects with `file-answer`.
6. File chunks are sent over the data channel with buffered amount backpressure.
7. Progress updates until transfer completion.
8. Transfer metadata is persisted in SQLite; local file availability is persisted in IndexedDB on the sender side.

## Leave A Room

1. The user leaves the meeting route or sends `leave`.
2. The backend removes the peer from the in-memory room.
3. Other peers receive `peer-left`.
4. The backend logs a `leave` event.
5. If the room has no active or pending peers, the in-memory session is closed.

## Mobile Meeting Use

1. Header and bottom controls remain fixed.
2. The scrollable content area contains participant tiles.
3. Camera and screen-share media use fit behavior to avoid unwanted crop.
4. Maximized media must stay inside viewport width and height.
5. Screen sharing is shown only when the mobile browser exposes screen capture APIs.
