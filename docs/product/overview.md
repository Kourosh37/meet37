# Product Overview

meet37 is a self-hostable browser meeting application. It provides room creation, room joining, camera, microphone, screen sharing, chat, participant management, and file transfer through a Next.js frontend and a Go backend.

The application is designed to run behind a reverse proxy such as Caddy and to keep deployment-specific values in environment variables. The same codebase supports local Docker development, production image deployment, and offline image export.

## Primary Users

- Guests who create or join public rooms without an account when the application mode is `public`.
- Registered users who sign in when the application mode is `private`.
- Room hosts who own a room through a host token or authenticated host identity.
- Administrators who manage application mode, users, live room stats, and SFU stats.
- Operators who deploy, monitor, and troubleshoot the service.

## Core Capabilities

- Create rooms with a name, optional password, join policy, participant limit, and optional expiration.
- Join rooms with a display name, optional password, and optional host token.
- Prevent duplicate display names inside a room.
- Require host approval for rooms configured with `join_policy=approval`.
- Send and receive camera, microphone, and screen share media.
- Show media loading and readiness states per participant tile.
- Show connection quality and speaking activity in the meeting UI.
- Send chat messages and load room chat history.
- Share files through WebRTC data channels and keep local file-share metadata for rejoin cases.
- Provide admin pages for settings, users, rooms, and SFU statistics.
- Support dark and light themes.
- Support responsive desktop and mobile meeting layouts.

## Application Modes

`DEFAULT_APP_MODE=public` allows anonymous room creation and anonymous room joining.

`DEFAULT_APP_MODE=private` requires authentication for room creation and restricts user registration to administrators. Room joining may still use optional authentication depending on the room flow and backend access checks.

The current app mode is stored in the SQLite `settings` table and can be read from `/api/settings`. Administrators can update it through `/api/admin/settings`.

## Room Lifecycle

1. A room is created through `POST /api/rooms`.
2. The backend stores the room and returns a `host_token`.
3. Participants open a WebSocket connection to `/ws`.
4. Participants send a `join` signal with `room_id`, `display_name`, optional `password`, and optional `host_token`.
5. The backend validates room existence, expiration, lock state, password, duplicate display name, participant count, and join policy.
6. The backend sends `joined` or a specific error/waiting signal.
7. Participants exchange WebRTC signaling messages through the backend.
8. Media, chat, audio level, stats, moderation, and file-transfer signals continue while the room is active.
9. When participants leave, the hub broadcasts `peer-left`.
10. When a room becomes empty, the in-memory room session is closed.

## Browser And Mobile Expectations

The application requires browser APIs for WebRTC, media devices, WebSocket, and IndexedDB. Camera and microphone require a secure context on production domains, meaning HTTPS is required except for localhost development.

Screen sharing depends on browser support. Desktop Chromium and Firefox expose `getDisplayMedia`. Mobile support is browser and OS dependent; when a browser does not expose screen capture, the application must fail gracefully and explain that the current browser cannot share the screen.

## Current Boundaries

- The backend uses SQLite by default and is optimized for simple single-node deployments.
- Redis is optional and only needed for multi-instance signaling coordination.
- File bytes are transferred peer-to-peer over data channels, not stored on the backend.
- File history and chat history are persisted as metadata/messages, not as server-hosted downloadable file blobs.
- The built-in SFU logic is part of the backend media coordination layer; production media reliability still depends on correct public IP, UDP ports, Docker publishing, and firewall rules.
