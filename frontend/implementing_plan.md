# Frontend Implementation Plan

This plan is the working roadmap for turning the current comment-only frontend scaffold into a production-ready meeting application. Backend behavior is treated as complete and authoritative; frontend implementation must follow `../backend/docs/API.md` and `../backend/docs/WEBSOCKET.md`.

## Current Baseline

- Next.js App Router project exists under `frontend/`.
- Package management is pnpm-only through `packageManager` and `pnpm-lock.yaml`.
- Feature folders are in place for auth, rooms, prejoin, meeting, and admin.
- Source files currently contain architecture notes and minimal placeholders, not production logic.
- Backend already provides auth, public/private app mode, room creation, room metadata, WebSocket signaling, moderation, chat metadata, file metadata, and SFU stats/fallback contracts.

## Implementation Principles

- Keep routes thin. Pages should compose feature components and route params only.
- Keep backend contracts centralized in typed API and WebSocket layers.
- Keep browser-only code inside client components, hooks, or lib modules that are never imported by server components.
- Use React Query for REST server state and Zustand for ephemeral runtime state.
- Treat room links as public entry points. Private app mode restricts room creation, not opening a shared room link.
- Store `host_token` as room-scoped session authority. Do not put it in URLs or logs.
- Implement feature slices vertically and verify each slice before moving to the next one.

## Phase 1 - Project Hygiene and Valid Shell

Goal: make the placeholder app buildable before adding business logic.

Tasks:
- [x] Replace placeholder route returns with minimal accessible shells.
- [x] Mount `QueryProvider`, `ThemeProvider`, and `ToastProvider` in the root layout.
- [x] Define global metadata and app language.
- [x] Configure Tailwind tokens in `globals.css` and verify light/dark theme variables.
- [x] Ensure `pnpm typecheck`, `pnpm lint`, and `pnpm build` run against the empty shell.
- [x] Remove or rename any file that duplicates another responsibility.

Acceptance:
- [x] Home, login, room creation, prejoin, and admin routes render minimal screens.
- [x] No stale `.next` generated types refer to removed route groups.
- [x] The project has no npm lockfiles or npm-specific commands.

## Phase 2 - Shared Types, Environment, and Utilities

Goal: define stable contracts before wiring UI.

Tasks:
- [x] Implement `src/types/api.ts` from backend REST docs.
- [x] Implement `src/features/meeting/types/signaling.ts` from backend WebSocket docs.
- [x] Implement `src/features/meeting/types/peer.ts`, `media.ts`, and `file.ts`.
- [x] Implement `src/types/env.d.ts` and runtime environment validation for `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_URL`.
- [x] Implement `logger.ts` with redaction for tokens, host tokens, SDP, and ICE candidates.
- [x] Implement `formatters.ts`, `validators.ts`, `cn.ts`, and `fileChunker.ts`.

Acceptance:
- [x] Shared types compile without importing React.
- [x] Validation schemas cover login, room creation, prejoin display name/password, and admin user forms.
- [x] Utility tests cover validation, formatting, chunk sizing, and redaction.

## Phase 3 - REST API Infrastructure

Goal: create a typed API foundation for all feature modules.

Tasks:
- [x] Implement endpoint builders in `src/lib/api/endpoints.ts`.
- [x] Implement HTTP client in `src/lib/api/client.ts`.
- [x] Normalize backend `{ error: string }` responses into a typed client error.
- [x] Attach bearer access tokens only through the auth/token layer.
- [x] Add one refresh/retry path for expired access tokens where safe.
- [x] Keep raw Axios/fetch details out of feature components.

Acceptance:
- [x] API modules can call backend endpoints without hard-coded strings.
- [x] 400/401/403/404 responses map to predictable frontend errors.
- [ ] Refresh failure clears auth state and returns the user to login where appropriate.

## Phase 4 - Authentication

Goal: support admin login and private-mode user login.

Tasks:
- Implement `tokenStorage.ts` for access token, refresh token, expiry timestamps, and room host tokens.
- Implement `authApi.ts` for login, refresh, and logout.
- Implement `authStore.ts` and `useAuth.ts`.
- Implement `LoginForm.tsx` with validation, loading state, and error handling.
- Implement `AuthGuard.tsx` for admin pages.
- Implement route behavior for `/login` and admin redirects.

Acceptance:
- Admin can log in with backend credentials from `.env`.
- User tokens survive page refresh according to the chosen storage policy.
- Logout revokes refresh token and clears local auth state.
- Admin-only pages handle anonymous, user, and admin roles correctly.

## Phase 5 - Rooms and Public/Private Creation Rules

Goal: allow users to list and create rooms according to app mode.

Tasks:
- Implement `roomsApi.ts` for room list, create, get, delete, chat history, and file history.
- Implement `useCreateRoom.ts` and `useRoomMeta.ts` with React Query.
- Implement `RoomCreationForm.tsx` with name, password, join policy, max peers, and expiry.
- Persist returned `host_token` per room after successful creation.
- Implement `RoomList.tsx` and room navigation.
- Handle private-mode create failures by directing users to login.

Acceptance:
- Public mode allows anonymous room creation.
- Private mode requires admin/user JWT for room creation.
- Shared room links remain openable without global login.
- Created room navigation preserves host authority for the creator session.

## Phase 6 - Prejoin and Device Setup

Goal: collect identity and media preferences before connecting to the room.

Tasks:
- Implement room metadata loading for `/meet/[roomId]`.
- Implement `DisplayNameInput.tsx`, `PasswordPrompt.tsx`, and `DeviceSetup.tsx`.
- Implement `useDeviceSetup.ts` for camera/mic enumeration, preview, mute defaults, and permission errors.
- Persist display name locally for convenience.
- Keep password only in memory for the join attempt.

Acceptance:
- Join is blocked until display name is non-empty.
- Password input appears only for password-protected rooms.
- Camera/mic permission denied states are clear and recoverable.
- Approval rooms clearly tell guests they may need host admission.

## Phase 7 - WebSocket Signaling Foundation

Goal: connect to rooms and process backend realtime messages.

Tasks:
- Implement `WebSocketManager.ts` with connect, send, subscribe, reconnect, heartbeat, and close.
- Implement `messageRouter.ts` for typed dispatch.
- Implement `useWebSocket.ts` and `useSignalingMessages.ts`.
- Implement `meetingStore.ts` for current room, local peer, remote peers, pending guests, and phase.
- Send join payload with `display_name`, optional password, and optional `host_token`.
- Handle joined, waiting, rejected, kicked, room closed, peer joined, and peer left messages.

Acceptance:
- Open rooms join immediately.
- Approval rooms put non-host guests into waiting state.
- Hosts receive join requests and guests receive approve/reject outcomes.
- Reconnect does not duplicate peers or leak listeners.

## Phase 8 - P2P WebRTC Media

Goal: establish direct browser-to-browser media calls.

Tasks:
- Implement `PeerConnectionFactory.ts`.
- Implement `useLocalMedia.ts`, `usePeerConnection.ts`, and `usePeerConnections.ts`.
- Add local tracks to every peer connection.
- Relay offers, answers, and ICE candidates through WebSocket.
- Implement `mediaStore.ts` for mic/camera/screen state.
- Implement `LocalVideoPreview.tsx`, `VideoTile.tsx`, and `VideoGrid.tsx`.

Acceptance:
- Two browsers can join the same room and exchange audio/video.
- Additional peers create stable connections without layout shift.
- Mic/camera toggles update local tracks and UI.
- Leaving a call stops tracks and closes peer connections.

## Phase 9 - Meeting UI and Moderation

Goal: make the call usable for real meetings.

Tasks:
- Implement `MeetingRoom.tsx` composition.
- Implement `ControlBar.tsx`, `ParticipantsPanel.tsx`, `ParticipantItem.tsx`, `AdmissionModal.tsx`, `WaitingRoom.tsx`, and `SettingsDrawer.tsx`.
- Implement `useModeration.ts` for approve, reject, mute request, and kick.
- Add copy invite link behavior.
- Add kicked/rejected/closed overlays.

Acceptance:
- Host can approve/reject pending guests.
- Host can request mute and kick participants.
- Participants see accurate local and remote mute/camera state.
- Meeting controls are keyboard accessible and responsive.

## Phase 10 - Chat and File Transfer Metadata

Goal: support in-call text and file-transfer signaling.

Tasks:
- Implement `chatStore.ts`, `useChat.ts`, `ChatPanel.tsx`, and `ChatMessage.tsx`.
- Load persisted chat history from REST and append live WebSocket messages.
- Implement file metadata store and `useFileTransfer.ts`.
- Implement `FileTransferPanel.tsx` and `FileTransferItem.tsx`.
- Use backend file-offer/file-answer signaling for metadata.

Acceptance:
- Chat history loads oldest-first and live messages append correctly.
- Unread counts clear when the chat panel opens.
- File offers can be accepted/rejected at the signaling level.
- Metadata history is visible after refresh.

## Phase 11 - DataChannel File Bytes

Goal: transfer actual file bytes browser-to-browser.

Tasks:
- Implement DataChannel creation and negotiation alongside peer connections.
- Use `fileChunker.ts` for chunking, backpressure, progress, cancellation, and reassembly.
- Create object URLs for completed downloads and revoke them after expiry.
- Enforce max file size and safe MIME/name display.

Acceptance:
- Accepted file transfers move bytes without backend upload.
- Progress updates are accurate for sender and receiver.
- Cancelled or failed transfers clean up buffers and object URLs.

## Phase 12 - SFU Fallback and Quality Stats

Goal: respond to backend fallback decisions and report quality.

Tasks:
- Implement `statsCollector.ts`, `statsWorker.ts`, and `useQualityStats.ts`.
- Send periodic stats reports over WebSocket.
- Implement `SFUClient.ts` and `useSFUConnection.ts`.
- Handle `sfu-switch`, `sfu-offer`, `sfu-answer`, `sfu-ice-candidate`, and renegotiation messages.
- Implement `SFUBanner.tsx`.

Acceptance:
- Client reports quality stats without blocking UI.
- SFU mode can be entered from a backend signal.
- UI clearly indicates relay mode without disrupting the call.
- SFU cleanup works when leaving the room.

## Phase 13 - Admin Panel

Goal: expose backend administration workflows.

Tasks:
- Implement `adminApi.ts`.
- Implement admin settings hook and `AppModeToggle.tsx`.
- Implement admin users hook, `UserTable.tsx`, and `CreateUserModal.tsx`.
- Implement room stats hook and `LiveRoomsTable.tsx`.
- Implement `SFUStatsPanel.tsx`.
- Complete admin routes and sidebar navigation.

Acceptance:
- Admin can switch public/private mode.
- Admin can create, update, and delete private-mode users.
- Admin can view live room stats and SFU stats.
- Non-admin users cannot access admin routes.

## Phase 14 - Testing and Verification

Goal: lock down behavior before larger UI polish.

Tasks:
- Add unit tests for validators, API error mapping, token storage, message routing, and stores.
- Add integration tests for login, room creation, prejoin, admin users, and room metadata.
- Add Playwright E2E for public room creation, private room guard, approval flow, chat, and host kick.
- Add browser media mocks for CI where real devices are unavailable.
- Run backend and frontend together for smoke tests.

Acceptance:
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` pass.
- E2E smoke tests pass against a local backend.
- Regression tests cover the core business rules from backend docs.

## Phase 15 - UI Polish, Accessibility, and Production Readiness

Goal: make the product feel complete and reliable.

Tasks:
- Refine responsive layouts for mobile, tablet, and desktop.
- Add focus states, aria labels, keyboard shortcuts, and reduced-motion behavior.
- Add empty/error/loading states across all pages.
- Review color contrast and dark/light theme consistency.
- Add production Docker verification.
- Document frontend env vars, run commands, and known browser limitations.

Acceptance:
- Core flows are usable by keyboard.
- Text does not overflow fixed controls on mobile.
- Docker build and runtime container work with backend URL env vars.
- README reflects the actual implementation state.

## Recommended Commit Sequence

1. Buildable shell and providers.
2. Shared types and utilities.
3. REST client and auth.
4. Rooms and prejoin.
5. WebSocket and meeting store.
6. P2P media.
7. Meeting UI and moderation.
8. Chat and file metadata.
9. DataChannel file bytes.
10. SFU fallback and stats.
11. Admin panel.
12. Tests, polish, and docs.
