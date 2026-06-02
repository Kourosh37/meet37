# Feature Catalog

This catalog describes the current meet37 product surface. Use it as the checklist for product QA, documentation updates, and future regression testing.

## Rooms

- Create a room through the frontend room creation form or `POST /api/rooms`.
- List non-expired rooms through `GET /api/rooms`.
- Load room metadata and live stats through `GET /api/rooms/{roomId}`.
- Delete a room as the host or an admin through `DELETE /api/rooms/{roomId}`.
- Configure optional room password.
- Configure join policy as `open` or `approval`.
- Configure maximum peers; invalid or very high values are normalized by the backend.
- Configure expiration using `expires_in`.
- Store a host token for host-level actions when the creator is anonymous.

## Joining

- Join with a display name.
- Join with a room password when required.
- Join as host using the returned `host_token`.
- Stop joining when the display name is already used in the room.
- Enter waiting state when the room requires host approval.
- Receive approval or rejection from the host.
- Receive clear errors for wrong password, locked room, expired/missing room, full room, and duplicate display name.

## Meeting Media

- Toggle microphone.
- Toggle camera.
- Toggle screen share.
- Keep camera and screen share mutually exclusive when required by UI flow.
- Show per-tile loading states while media is starting or waiting for remote tracks.
- Show media-ready states when remote audio/video/screen tracks arrive.
- Play remote audio through `RemoteAudioPlayer`.
- Use connection quality data from `useQualityStats`.
- Send local speaking/audio-level information over signaling.
- Show remote speaking indicators when audio-level signals arrive.

## Participant UI

- Show local and remote participant tiles.
- Prioritize tiles by screen sharing, camera, microphone, then inactive state.
- Support tile maximize/minimize.
- Keep maximized mobile media inside the viewport.
- Fit camera and screen share without cropping when the UI requires full media visibility.
- Show participant list and participant status.

## Chat

- Send chat messages through WebSocket `chat` signals.
- Persist chat messages in SQLite.
- Load the last 500 room chat messages through `GET /api/rooms/{roomId}/chat`.

## File Transfer

- Send file offers over signaling.
- Accept or reject file offers.
- Transfer bytes through WebRTC data channels.
- Send file ICE/data channel candidates when needed.
- Track transfer progress in the UI.
- Persist file-transfer metadata in SQLite.
- Persist local file-share metadata in IndexedDB so rejoining clients can recover local state.
- Apply data channel open waits, retry behavior, and backpressure handling.

## Admin

- Login with admin credentials from environment variables.
- Read and update application mode.
- Create, update, list, and delete users.
- View live room stats.
- View SFU stats.

## Deployment And Operations

- Local Docker Compose with build-from-source services.
- Production Docker Compose with prebuilt images.
- Caddy-compatible reverse proxy deployment.
- Offline Docker image archive generation.
- Server requirements checker for Docker, Python, ports, env values, and firewall.
- GitHub Actions CI/CD for the `production` branch.
