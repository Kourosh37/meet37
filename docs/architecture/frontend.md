# Frontend Architecture

The frontend is a Next.js 15 application using React 19, TypeScript, Tailwind CSS, Radix UI, TanStack Query, Zustand, Sonner toasts, and browser WebRTC APIs.

## Route Structure

```text
frontend/src/app/
  (main)/                 public landing and room creation
  (auth)/login/           login route
  admin/                  admin dashboard routes
  meet/[roomId]/          meeting room route
  layout.tsx              root providers and metadata
  globals.css             global theme and layout styles
```

## Feature Structure

```text
frontend/src/features/
  admin/       admin API, hooks, and tables
  auth/        login form, auth hooks, token store
  meeting/     meeting UI, WebRTC hooks, stores, types
  prejoin/     device setup and join inputs
  rooms/       room creation, list, metadata
```

Shared runtime code lives in `frontend/src/lib/`:

- `api/` for API client and endpoint definitions.
- `env.ts` for public runtime URL resolution.
- `storage/` for token storage.
- `utils/` for formatting, validation, chunking, logging, and class merging.
- `webrtc/` for peer connection factory, SFU client, stats, audio quality, and data channel registry.
- `websocket/` for WebSocket connection and message routing.

## Public Environment Resolution

The frontend supports `browser-origin` for both `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_URL`.

When set to `browser-origin`, browser code resolves:

- API base URL to `window.location.origin`.
- WebSocket URL to `ws://<origin>/ws` or `wss://<origin>/ws`.

This keeps production deployments reverse-proxy friendly and avoids hard-coded domains.

## Next.js Rewrites

`frontend/next.config.mjs` requires `BACKEND_INTERNAL_URL` and rewrites:

- `/api/:path*` to `${BACKEND_INTERNAL_URL}/api/:path*`
- `/ws` to `${BACKEND_INTERNAL_URL}/ws`

This means the browser can call the frontend origin while the Next.js server forwards API and WebSocket traffic to the backend service.

## State Management

Zustand stores are used for meeting state:

- `meetingStore.ts` for participants, join status, and room state.
- `mediaStore.ts` for local and remote media state.
- `chatStore.ts` for chat messages.
- `fileTransferStore.ts` for file transfer records.
- `uiStore.ts` for panels, selected views, and UI state.

TanStack Query is used for HTTP data fetching such as rooms, auth-dependent admin data, and settings.

## Meeting Components

Key meeting components:

- `MeetingRoom.tsx` orchestrates room UI and hooks.
- `PreJoinSetup.tsx` handles display name and pre-join devices.
- `VideoGrid.tsx` lays out participant tiles.
- `VideoTile.tsx` renders local/remote media and tile actions.
- `ControlBar.tsx` renders meeting controls.
- `ConnectionQualityIndicator.tsx` renders connection quality.
- `RemoteAudioPlayer.tsx` attaches remote audio streams to audio elements.
- `FileTransferPanel.tsx` and `FileTransferItem.tsx` render file transfer state.

## WebRTC Hooks

- `useLocalMedia.ts` captures and toggles local audio/video/screen tracks.
- `usePeerConnection.ts` handles a single peer connection.
- `usePeerConnections.ts` coordinates all peer connections in the room.
- `useSFUConnection.ts` handles SFU-specific negotiation.
- `useQualityStats.ts` collects connection quality.
- `useAudioLevel.ts` measures speaking activity.
- `useSignalingMessages.ts` handles incoming WebSocket messages.
- `useWebSocket.ts` owns WebSocket lifecycle.

## File Transfer

File transfer uses:

- `useFileTransfer.ts` for offer/answer/chunk orchestration.
- `DataChannelRegistry.ts` for data channel registration and open-state waiting.
- `fileChunker.ts` for chunking files.
- `persistentFileShares.ts` for local IndexedDB persistence.

File bytes are not uploaded to the backend.

## Testing

The frontend test stack includes:

- Vitest for unit and integration tests.
- Testing Library for component tests.
- Playwright for E2E tests.
- ESLint, TypeScript, and Prettier checks.
