# Frontend Architecture

This document replaces the raw planning prompt with the working frontend architecture for the meeting app.

## Stack

- Next.js App Router with TypeScript strict mode.
- Tailwind CSS, shadcn/ui-style Radix primitives, `lucide-react`, and `next-themes`.
- TanStack React Query for REST-backed server state.
- Zustand for ephemeral client state such as peers, media toggles, panels, and auth session state.
- Native WebSocket for signaling.
- Native WebRTC for P2P media, SFU fallback negotiation, and DataChannel file transfer.
- Vitest/React Testing Library for units and Playwright for multi-browser E2E flows.

## Architecture Rules

- Routes compose features; they should not own transport or media logic.
- Hooks orchestrate browser APIs and state transitions.
- Services own low-level IO: REST, WebSocket, WebRTC helpers, token storage, and file chunking.
- Stores hold only client runtime state. REST cache belongs in React Query.
- Components stay presentational whenever possible and receive actions from hooks.
- Browser-only code must stay out of server components.

## Backend Contracts

REST integration must match `backend/docs/API.md`.

Required frontend REST areas:

- Auth: login, refresh, logout.
- Rooms: create, list, read, delete.
- Room history: chat and file-transfer metadata.
- Admin: settings, users, room stats, SFU stats.

WebSocket integration must match `backend/docs/WEBSOCKET.md`.

Required frontend realtime areas:

- Room join and approval flow.
- P2P offer/answer/ICE relay.
- Chat broadcast.
- Host moderation.
- Stats reporting.
- SFU fallback.
- Browser-to-browser file-transfer metadata signaling.

## P2P-First Media

The default media path is direct browser-to-browser WebRTC. The backend only coordinates signaling until the client receives `sfu-switch` or explicitly starts SFU negotiation.

SFU fallback must use a dedicated peer connection and handle:

- `sfu-offer`
- `sfu-answer`
- `sfu-ice-candidate`
- `sfu-renegotiate-needed`
- `peer-mode-changed`

## File Sharing

File bytes must move over WebRTC DataChannel. The backend stores only transfer metadata. The frontend owns chunking, backpressure, cancellation, reassembly, object URL cleanup, and user confirmation.

## Docker

The frontend has its own Dockerfile and compose file. The runtime target is a production Next.js container on port `3000`. The compose service reads public backend URLs from `.env` when available and falls back to localhost defaults.

## Implementation Order

The detailed working plan lives in `../implementing_plan.md`. Keep this summary aligned with that file when phase boundaries change.

1. Turn placeholder routes into minimal valid pages and providers.
2. Implement environment parsing and typed API client.
3. Implement auth store and refresh flow.
4. Implement room creation and prejoin.
5. Implement WebSocket service and room store.
6. Implement P2P WebRTC.
7. Add chat and file metadata history.
8. Add DataChannel file transfer.
9. Add SFU fallback.
10. Add admin panel.
11. Add unit and E2E coverage.
