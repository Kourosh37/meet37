# Meet — Frontend Architecture Specification

### Version 1.0 | Production-Ready Next.js Implementation Guide

-----

## Table of Contents

1. [Executive Summary](#1-executive-summary)
1. [Project Structure & Folder Organization](#2-project-structure--folder-organization)
1. [Tech Stack & Justification](#3-tech-stack--justification)
1. [Component Architecture & Hierarchy](#4-component-architecture--hierarchy)
1. [State Management Strategy](#5-state-management-strategy)
1. [Data Fetching & Caching Strategy](#6-data-fetching--caching-strategy)
1. [Real-Time Communication Architecture](#7-real-time-communication-architecture)
1. [Authentication & Authorization Flow](#8-authentication--authorization-flow)
1. [Routing & Page Structure](#9-routing--page-structure)
1. [Styling & Theming Approach](#10-styling--theming-approach)
1. [Performance Optimization](#11-performance-optimization)
1. [Accessibility (a11y)](#12-accessibility-a11y)
1. [Testing Strategy](#13-testing-strategy)
1. [CI/CD & Deployment Pipeline](#14-cicd--deployment-pipeline)
1. [UI/UX Guidelines](#15-uiux-guidelines)

-----

## 1. Executive Summary

This document specifies the complete frontend architecture for **Meet**, a browser-based video conferencing application. The system is a Google Meet-class product built atop a Go backend that operates in **P2P-first** mode with automatic SFU fallback. The frontend must orchestrate browser media APIs, WebRTC peer connections, a persistent WebSocket signaling channel, REST-based room/admin management, and a real-time moderation system — all within a polished, accessible, and highly performant interface.

### Core Architectural Decisions

|Concern     |Decision                                     |Rationale                                                |
|------------|---------------------------------------------|---------------------------------------------------------|
|Framework   |Next.js 14 (App Router)                      |SSR/SSG for pre-join pages, client components for WebRTC |
|Language    |TypeScript (strict)                          |End-to-end type safety across API, WS, and WebRTC layers |
|Styling     |Tailwind CSS + CSS Variables                 |Utility-first with design token system                   |
|Server State|TanStack Query v5                            |Automatic caching, background refresh, optimistic updates|
|Client State|Zustand                                      |Lightweight atom-style store for meeting room state      |
|Real-Time   |Custom WebSocket manager + native WebRTC APIs|Full control over signaling lifecycle                    |
|Testing     |Vitest + Playwright                          |Fast unit tests, real-browser E2E                        |

### System Boundaries

The frontend is responsible for:

- All WebRTC peer connection lifecycle management (offer/answer/ICE)
- Local and remote media track handling (camera, microphone, screen share)
- WebSocket connection management and message routing
- P2P → SFU fallback execution on receiving `sfu-switch`
- File transfer over WebRTC DataChannels
- Quality stats collection and periodic reporting
- Token storage and silent refresh

The backend is responsible for:

- Signaling relay (SDP/ICE forwarding)
- Room metadata and access control
- Chat and file-transfer metadata persistence
- SFU fallback decision-making and Pion media relay
- Admin configuration

-----

## 2. Project Structure & Folder Organization

The project follows a **feature-collocated** structure within the Next.js App Router convention. All business logic lives in `src/`, clearly separated from framework conventions.

```
meet-frontend/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, type-check, test
│       └── deploy.yml                # Staging/production deployment
├── public/
│   ├── icons/                        # SVG icon sprites, favicon sets
│   ├── sounds/                       # Join/leave chime audio files
│   └── manifest.json                 # PWA manifest
├── src/
│   ├── app/                          # Next.js App Router (pages & layouts)
│   │   ├── (auth)/                   # Route group: auth pages (no main layout)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx            # Minimal auth shell layout
│   │   ├── (main)/                   # Route group: app pages (with nav layout)
│   │   │   ├── layout.tsx            # Main layout with nav/sidebar
│   │   │   ├── page.tsx              # Home / room discovery
│   │   │   └── rooms/
│   │   │       └── new/
│   │   │           └── page.tsx      # Room creation form
│   │   ├── meet/
│   │   │   └── [roomId]/
│   │   │       ├── page.tsx          # Pre-join / lobby page (SSR)
│   │   │       ├── loading.tsx       # Suspense skeleton
│   │   │       └── error.tsx         # Room not found / expired
│   │   ├── admin/
│   │   │   ├── layout.tsx            # Admin shell with sidebar nav
│   │   │   ├── page.tsx              # Admin dashboard
│   │   │   ├── users/
│   │   │   │   └── page.tsx          # User management
│   │   │   ├── rooms/
│   │   │   │   └── page.tsx          # Live room stats
│   │   │   └── settings/
│   │   │       └── page.tsx          # App mode settings
│   │   ├── layout.tsx                # Root layout (fonts, providers)
│   │   ├── globals.css               # CSS variables, resets
│   │   └── not-found.tsx             # Global 404
│   │
│   ├── components/                   # Shared UI components
│   │   ├── ui/                       # Design system primitives (shadcn-based)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── ...
│   │   ├── layout/                   # Structural layout components
│   │   │   ├── PageShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   └── shared/                   # Reusable business components
│   │       ├── RoomCard.tsx
│   │       ├── UserAvatar.tsx
│   │       ├── ConnectionQualityIndicator.tsx
│   │       └── ErrorBoundary.tsx
│   │
│   ├── features/                     # Feature-collocated modules
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── AuthGuard.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   ├── stores/
│   │   │   │   └── authStore.ts
│   │   │   └── api/
│   │   │       └── authApi.ts
│   │   ├── rooms/
│   │   │   ├── components/
│   │   │   │   ├── RoomCreationForm.tsx
│   │   │   │   ├── RoomList.tsx
│   │   │   │   └── RoomPasswordModal.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useRoomMeta.ts
│   │   │   │   └── useCreateRoom.ts
│   │   │   └── api/
│   │   │       └── roomsApi.ts
│   │   ├── meeting/                  # The core meeting feature
│   │   │   ├── components/
│   │   │   │   ├── MeetingRoom.tsx           # Root meeting component
│   │   │   │   ├── VideoGrid.tsx             # Responsive tile layout
│   │   │   │   ├── VideoTile.tsx             # Single participant tile
│   │   │   │   ├── LocalVideoPreview.tsx     # Self-view
│   │   │   │   ├── ControlBar.tsx            # Bottom action bar
│   │   │   │   ├── ChatPanel.tsx             # Side chat drawer
│   │   │   │   ├── ChatMessage.tsx
│   │   │   │   ├── ParticipantsPanel.tsx     # Participant list drawer
│   │   │   │   ├── ParticipantItem.tsx
│   │   │   │   ├── WaitingRoom.tsx           # Pre-approval waiting screen
│   │   │   │   ├── AdmissionModal.tsx        # Host: approve/reject guests
│   │   │   │   ├── FileTransferPanel.tsx
│   │   │   │   ├── FileTransferItem.tsx
│   │   │   │   ├── PreJoinSetup.tsx          # Device/name setup before join
│   │   │   │   └── SFUBanner.tsx             # Network fallback notice
│   │   │   ├── hooks/
│   │   │   │   ├── useMeetingRoom.ts         # Root meeting orchestrator
│   │   │   │   ├── useLocalMedia.ts          # getUserMedia / getDisplayMedia
│   │   │   │   ├── usePeerConnection.ts      # Single RTCPeerConnection lifecycle
│   │   │   │   ├── usePeerConnections.ts     # Multi-peer map manager
│   │   │   │   ├── useSFUConnection.ts       # SFU fallback connection
│   │   │   │   ├── useWebSocket.ts           # WS connection lifecycle
│   │   │   │   ├── useSignalingMessages.ts   # WS message router
│   │   │   │   ├── useQualityStats.ts        # getStats + periodic reporting
│   │   │   │   ├── useChat.ts                # Chat state + send
│   │   │   │   ├── useFileTransfer.ts        # DataChannel file transfers
│   │   │   │   └── useModeration.ts          # Host moderation actions
│   │   │   ├── stores/
│   │   │   │   ├── meetingStore.ts           # Room + peer list state
│   │   │   │   ├── mediaStore.ts             # Local track state
│   │   │   │   ├── chatStore.ts              # Chat messages
│   │   │   │   └── fileTransferStore.ts      # File transfer state
│   │   │   ├── workers/
│   │   │   │   └── statsWorker.ts            # WebWorker for stats processing
│   │   │   └── types/
│   │   │       ├── signaling.ts              # WS message type definitions
│   │   │       ├── peer.ts                   # Peer record types
│   │   │       └── media.ts                  # Track/stream types
│   │   ├── admin/
│   │   │   ├── components/
│   │   │   │   ├── UserTable.tsx
│   │   │   │   ├── CreateUserModal.tsx
│   │   │   │   ├── AppModeToggle.tsx
│   │   │   │   ├── LiveRoomsTable.tsx
│   │   │   │   └── SFUStatsPanel.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAdminUsers.ts
│   │   │   │   ├── useAdminRooms.ts
│   │   │   │   └── useAdminSettings.ts
│   │   │   └── api/
│   │   │       └── adminApi.ts
│   │   └── prejoin/
│   │       ├── components/
│   │       │   ├── DeviceSetup.tsx
│   │       │   ├── DisplayNameInput.tsx
│   │       │   └── PasswordPrompt.tsx
│   │       └── hooks/
│   │           └── useDeviceSetup.ts
│   │
│   ├── lib/                          # Core utilities and service singletons
│   │   ├── api/
│   │   │   ├── client.ts             # Axios/fetch base client with interceptors
│   │   │   └── endpoints.ts          # All API endpoint constants
│   │   ├── websocket/
│   │   │   ├── WebSocketManager.ts   # Singleton WS connection manager
│   │   │   └── messageRouter.ts      # Type-safe message dispatch
│   │   ├── webrtc/
│   │   │   ├── PeerConnectionFactory.ts
│   │   │   ├── SFUClient.ts
│   │   │   └── statsCollector.ts
│   │   ├── storage/
│   │   │   └── tokenStorage.ts       # In-memory + sessionStorage token vault
│   │   └── utils/
│   │       ├── cn.ts                 # clsx + tailwind-merge
│   │       ├── formatters.ts         # Date, size, duration formatters
│   │       └── validators.ts         # Form validation schemas (Zod)
│   │
│   ├── hooks/                        # Global shared hooks
│   │   ├── useMediaQuery.ts
│   │   ├── useKeyboard.ts
│   │   └── useOnlineStatus.ts
│   │
│   ├── providers/                    # React context providers
│   │   ├── QueryProvider.tsx         # TanStack Query client
│   │   ├── ThemeProvider.tsx         # Dark/light mode
│   │   └── ToastProvider.tsx         # Global notifications
│   │
│   └── types/                        # Global TypeScript types
│       ├── api.ts                    # REST response shapes
│       └── env.d.ts                  # Environment variable declarations
│
├── tests/
│   ├── unit/                         # Vitest unit tests
│   ├── integration/                  # Vitest component integration tests
│   └── e2e/                          # Playwright E2E tests
│       ├── auth.spec.ts
│       ├── room-creation.spec.ts
│       ├── meeting-flow.spec.ts
│       └── admin.spec.ts
│
├── .env.local                        # Local dev environment (gitignored)
├── .env.example                      # Template with all required vars
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

### Key Structural Decisions

**Feature-collocated modules**: Each feature folder contains its own components, hooks, stores, and API layer. This prevents cross-feature coupling and makes deletion/replacement of a feature clean.

**`lib/` as infrastructure**: Singletons that must be shared across features — the WebSocket manager, API client, token storage — live in `lib/`. These have no React dependencies. This enables use in server components, workers, and test harnesses.

**Strict separation of `app/` and `features/`**: Next.js `app/` directory contains only routing artifacts (page.tsx, layout.tsx, loading.tsx, error.tsx). All actual component code lives in `features/`. This prevents the App Router conventions from leaking into business logic.

-----

## 3. Tech Stack & Justification

### Core Framework

**Next.js 14 (App Router)**
The App Router provides server components for the pre-join and admin pages, which benefit from SSR for SEO and first-paint performance. The meeting room itself is a fully client-side component tree (`"use client"`), which is architecturally sound — WebRTC and WebSocket cannot run in server context. The App Router’s nested layouts enable the admin shell and meeting shell to be separate without duplication.

**TypeScript 5.x (strict mode)**
With a complex WebSocket message protocol (17+ distinct message types), three authentication roles, and a multi-stage WebRTC lifecycle, strict TypeScript is non-negotiable. All WebSocket message payloads, API responses, and RTCPeerConnection configurations will be fully typed, eliminating runtime ambiguity.

### Styling

**Tailwind CSS 3.x**
Utility-first approach produces consistent spacing, color, and typography without custom CSS proliferation. The design-token system is driven by CSS custom properties that Tailwind references, enabling dark mode and runtime theming without CSS-in-JS runtime cost.

**shadcn/ui (component primitives)**
shadcn/ui components are copied into `src/components/ui/` and owned by the project. They provide accessible, unstyled primitives (Dialog, Tooltip, DropdownMenu, etc.) built on Radix UI. This gives full control over markup and styling while providing correct ARIA patterns for free.

**class-variance-authority (CVA)**
Used for building variant-aware component APIs (e.g., Button with `size`, `variant`, `intent` props) without prop explosion.

### State Management

**TanStack Query v5 (server state)**
All REST API data — room metadata, admin user lists, chat history, file transfer history — is managed by TanStack Query. It provides automatic caching, background refetching, optimistic mutations, and request deduplication. The meeting pre-join page benefits from SSR prefetching of room metadata via `dehydrate/HydrationBoundary`.

**Zustand (client/meeting state)**
Meeting room state — peer list, local media track status, chat messages, SFU mode, moderation state — lives in Zustand stores. Zustand is chosen over Redux for its minimal boilerplate, React-independent core (compatible with testing and the WebSocket manager), and slices pattern for clean separation. The stores are deliberately kept free of async WebSocket logic; that lives in hooks.

**URL state (nuqs)**
Filter state, active panel (chat/participants), and device setup preferences are encoded in URL search parameters using `nuqs` (typed URL state for Next.js). This enables deep linking to a specific meeting state and browser back/forward support.

### Data Fetching

**Native `fetch` with custom wrapper**
A typed `apiClient` wrapper in `lib/api/client.ts` handles base URL injection, Authorization header attachment, token refresh on 401, and typed error parsing. TanStack Query consumes this client.

### Real-Time

**Native WebSocket API (managed singleton)**
The `WebSocketManager` in `lib/websocket/` is a framework-agnostic class that manages connection lifecycle, reconnection with exponential backoff, and message routing. It is not wrapped in React state — it is a singleton that persists across component trees and provides a subscription model to hooks.

**Native WebRTC APIs**
`RTCPeerConnection`, `RTCDataChannel`, `getUserMedia`, and `getDisplayMedia` are used directly. No WebRTC abstraction library is introduced, because the P2P-first + SFU fallback topology requires precise control over peer connection lifecycle that abstraction libraries typically obscure.

### Form Handling

**React Hook Form + Zod**
Room creation, login, admin forms, and display name inputs use React Hook Form for performant uncontrolled form management. Zod provides schema-based validation that is shared between form validation and API request typing.

### Notifications

**Sonner**
A lightweight, accessible toast notification library with a clean API (`toast.success()`, `toast.error()`). Used for join/leave events, file transfer offers, mute requests, and error conditions.

### Animation

**Framer Motion**
Used selectively for the video tile grid (participant join/leave animations), panel slide-ins (chat/participants), and modal entrances. Not used for anything that impacts WebRTC or media performance.

### Testing

**Vitest** — Unit and integration tests. Runs in the same TypeScript/module environment as the source.
**React Testing Library** — Component integration tests.
**Playwright** — E2E browser tests including WebRTC flows (using browser permissions mocking).
**MSW (Mock Service Worker)** — API mocking in integration tests.

### Monitoring & Observability

**Sentry** — Error tracking and session replay for production incidents.
**Web Vitals API** — Core Web Vitals collection sent to an analytics endpoint.
**Custom meeting telemetry** — WebRTC `getStats` data surfaced to the admin SFU stats endpoint.

### Build & Tooling

|Tool                           |Purpose                                      |
|-------------------------------|---------------------------------------------|
|`pnpm`                         |Fast, deterministic package manager          |
|`ESLint` + `eslint-config-next`|Linting with Next.js rules                   |
|`Prettier`                     |Code formatting                              |
|`Husky` + `lint-staged`        |Pre-commit checks                            |
|`Bundle Analyzer`              |`@next/bundle-analyzer` for bundle inspection|

-----

## 4. Component Architecture & Hierarchy

### Design Principles

**Smart / Dumb (Container / Presentational) split**: Hooks own all logic and side effects; components receive props and render. This makes components independently testable and reusable.

**Single responsibility**: Each component does one thing. `VideoTile` renders a single peer’s video and name. `ControlBar` renders the bottom action row. They do not know about each other.

**No prop drilling past 2 levels**: State accessed by deep components is read from Zustand stores directly via selectors.

### Top-Level Component Tree

The meeting room is the most complex page. Its tree:

```
MeetingRoom                         ← Root: owns WebSocket + peer connection lifecycle
├── MediaPermissionsGate            ← Ensures camera/mic access before render
├── VideoGrid                       ← Responsive participant layout engine
│   ├── VideoTile (×N)              ← Per-peer: video element, name, indicators
│   │   ├── RemoteVideoTrack        ← Attaches MediaStream to <video>
│   │   ├── PeerNameBadge           ← Display name overlay
│   │   ├── MutedIndicator          ← Audio/video mute status
│   │   └── ConnectionQualityDot    ← P2P / SFU mode + signal strength
│   └── LocalVideoTile              ← Self-view (mirrored)
│       └── LocalVideoPreview
├── ControlBar                      ← Fixed bottom bar
│   ├── MicToggle
│   ├── CameraToggle
│   ├── ScreenShareToggle
│   ├── ChatToggle
│   ├── ParticipantsToggle
│   ├── FileShareButton
│   └── LeaveButton
├── ChatPanel (drawer)              ← Slides in from right
│   ├── ChatHistory
│   │   └── ChatMessage (×N)
│   └── ChatInput
├── ParticipantsPanel (drawer)      ← Slides in from right
│   └── ParticipantItem (×N)
│       └── HostControls (if host)  ← Mute/Kick actions
├── AdmissionModal                  ← Host: approve/reject queue
│   └── AdmissionRequest (×N)
├── FileTransferPanel               ← File offer/progress UI
│   └── FileTransferItem (×N)
├── SFUBanner                       ← "Network quality degraded" notice
├── WaitingRoomOverlay              ← Shown before approval
└── KickedOverlay                   ← Shown on kick/room-closed
```

### Pre-Join Page Tree

```
PreJoinPage                         ← Server component: fetches room metadata
└── PreJoinClient                   ← Client component: device setup
    ├── RoomInfoCard                ← Room name, host, join policy display
    ├── DeviceSetup
    │   ├── CameraPreview           ← Local camera preview
    │   ├── MicrophoneLevel         ← Audio level meter
    │   ├── CameraSelector          ← Device picker dropdown
    │   └── MicrophoneSelector
    ├── DisplayNameInput
    ├── PasswordPrompt (conditional)
    └── JoinButton
```

### Admin Panel Tree

```
AdminLayout
├── AdminSidebar
└── AdminContent
    ├── DashboardPage
    │   └── LiveRoomsTable
    ├── UsersPage
    │   ├── UserTable
    │   └── CreateUserModal / EditUserModal
    ├── SettingsPage
    │   └── AppModeToggle
    └── SFUStatsPage
        └── SFUStatsPanel
```

### Design System Primitives

All primitives in `src/components/ui/` follow this API contract:

- Accept `className` for overrides
- Use CVA for variant management
- Forward refs where the underlying element requires it
- Export `VariantProps` types for consumer type safety
- Use Radix UI primitives for interactive elements (Dialog, Tooltip, Select, DropdownMenu)

Key primitives:

|Component                   |Description                                                  |
|----------------------------|-------------------------------------------------------------|
|`Button`                    |4 variants (default, secondary, ghost, destructive) × 3 sizes|
|`Input`                     |With label, error state, and helper text                     |
|`Dialog`                    |Accessible modal with focus trap                             |
|`Avatar`                    |Initials-based fallback with optional image                  |
|`Badge`                     |Semantic color variants for status indicators                |
|`Tooltip`                   |Hover/focus tooltip wrapping any trigger                     |
|`Skeleton`                  |Animated loading placeholder                                 |
|`Spinner`                   |Accessible loading spinner                                   |
|`ConnectionQualityIndicator`|3-bar signal indicator (green/yellow/red)                    |

-----

## 5. State Management Strategy

State is divided into four domains, each with a different management approach.

### 5.1 Server State (TanStack Query)

All data that originates from the backend REST API is server state. TanStack Query manages its lifecycle.

**Key query definitions:**

```
useRoomMeta(roomId)
  → GET /api/rooms/{id}
  → staleTime: 30s (room metadata rarely changes during pre-join)
  → refetchOnWindowFocus: false during active meeting

useRoomList()
  → GET /api/rooms
  → staleTime: 10s
  → used on home page for room discovery

useChatHistory(roomId)
  → GET /api/rooms/{id}/chat
  → staleTime: 0 (load once on join, then real-time WS takes over)
  → initialData seeded from WS join payload when available

useFileHistory(roomId)
  → GET /api/rooms/{id}/files
  → staleTime: 0

useAdminUsers()
  → GET /api/admin/users
  → staleTime: 60s

useAdminSettings()
  → GET /api/admin/settings
  → staleTime: 30s

useAdminSFUStats()
  → GET /api/admin/sfu/stats
  → refetchInterval: 5000 (live polling on admin page)
```

**Mutations:**

```
useCreateRoom()         → POST /api/rooms        (optimistic: add to list)
useLogin()              → POST /api/auth/login    (no cache)
useLogout()             → POST /api/auth/logout   (invalidates all queries)
useCreateUser()         → POST /api/admin/users   (optimistic: append to user list)
useUpdateUser()         → PUT /api/admin/users/{id}
useDeleteUser()         → DELETE /api/admin/users/{id} (optimistic: remove from list)
useUpdateSettings()     → PUT /api/admin/settings
```

All mutations use `onMutate` + `onError` rollback for optimistic updates where applicable.

### 5.2 Client State (Zustand)

Four Zustand stores cover meeting runtime state:

**`meetingStore`** — Peer and room state:

```
{
  roomId: string | null
  roomMeta: RoomMeta | null
  myPeerId: string | null
  isHost: boolean
  peers: Map<string, PeerRecord>
  pendingApprovals: PendingPeer[]
  meetingPhase: 'idle' | 'pre-join' | 'waiting-approval' | 'in-meeting' | 'left'
  kickReason: string | null
  sfuActive: boolean
}
```

**`mediaStore`** — Local track state:

```
{
  localStream: MediaStream | null
  screenStream: MediaStream | null
  audioEnabled: boolean
  videoEnabled: boolean
  screenShareEnabled: boolean
  selectedCameraId: string
  selectedMicId: string
  audioLevel: number           // 0–100, from AnalyserNode
}
```

**`chatStore`** — Chat messages:

```
{
  messages: ChatMessage[]
  unreadCount: number
  isChatOpen: boolean
}
```

**`fileTransferStore`** — Active and completed transfers:

```
{
  transfers: Map<string, FileTransfer>
  // FileTransfer: { fileId, name, size, mime, status, progress, direction, peerId }
}
```

### 5.3 Real-Time State (WebSocket-driven Zustand mutations)

The WebSocket message router dispatches incoming messages directly to Zustand store actions. This keeps real-time state immediately reactive without forcing components to subscribe to raw WebSocket events.

The dispatch chain:

```
WebSocketManager.onMessage
  → messageRouter.dispatch(message)
    → meetingStore.actions.peerJoined(payload)      // peer-joined
    → meetingStore.actions.peerLeft(peerId)          // peer-left
    → meetingStore.actions.addApprovalRequest(req)   // join-request
    → meetingStore.actions.setSFUActive(true)        // sfu-switch
    → chatStore.actions.addMessage(msg)              // chat
    → fileTransferStore.actions.receiveOffer(offer)  // file-offer
```

WebRTC signaling messages (`offer`, `answer`, `ice-candidate`) bypass the Zustand stores entirely and are handled by the `usePeerConnections` hook’s internal event callbacks, since they require immediate PeerConnection operations that don’t need to surface to the UI.

### 5.4 URL State (nuqs)

URL parameters encode UI navigation state that should survive page refresh:

```
/meet/[roomId]?panel=chat          → opens chat drawer
/meet/[roomId]?panel=participants  → opens participants drawer
/admin/rooms?sort=peers&dir=desc   → sorted room list
```

`nuqs` provides fully-typed hooks (`useQueryState`) that behave like `useState` but sync to the URL. This enables the browser back button to close a panel, and allows deep-linking to a specific meeting view.

### 5.5 State Persistence Policy

|State           |Persistence          |Rationale                                  |
|----------------|---------------------|-------------------------------------------|
|Access token    |In-memory (authStore)|Security: not in localStorage              |
|Refresh token   |`sessionStorage`     |Survives page refresh, cleared on tab close|
|Display name    |`localStorage`       |UX: pre-fill on next visit                 |
|Selected devices|`localStorage`       |UX: remember camera/mic preference         |
|Meeting state   |Zustand (memory)     |Ephemeral, rebuilt on reconnect            |
|Chat history    |Zustand + server     |Seeded from API on join                    |
|Theme preference|`localStorage`       |User preference                            |

-----

## 6. Data Fetching & Caching Strategy

### 6.1 Pre-Join Page (SSR)

The `meet/[roomId]/page.tsx` is a **server component** that fetches room metadata on the server using the `apiClient` with the user’s token (from request cookies if present, or unauthenticated). This provides:

- Immediate room name in `<title>` for sharing previews
- Instant 404/expired states without client-side loading flash
- Correct `has_password` and `join_policy` available before hydration

```
Server Component
  → fetch GET /api/rooms/{roomId}        (server-side, no CORS)
  → if 404: return notFound()             → renders error.tsx
  → if expired: return redirect('/')      → room unavailable page
  → pass roomMeta as prop to PreJoinClient (client component)
```

The server-fetched data is also passed to `HydrationBoundary` so TanStack Query on the client is pre-populated and avoids a redundant network request.

### 6.2 Admin Pages (SSR + ISR)

Admin pages are server-rendered with short ISR revalidation:

- `/admin` dashboard: `revalidate: 10` seconds
- `/admin/users`: `revalidate: 30` seconds
- `/admin/settings`: `revalidate: 60` seconds

After hydration, TanStack Query takes over and keeps data fresh client-side.

### 6.3 Chat History (Hybrid)

On joining a room, the `useChat` hook:

1. Seeds `chatStore` from `GET /api/rooms/{id}/chat` (up to 500 messages)
1. Switches to real-time WebSocket `chat` messages for new messages
1. On reconnect, re-fetches history and merges by timestamp, deduplicating by message `id`

### 6.4 Optimistic Updates

**Room creation**: When the user submits the room creation form, the new room is optimistically added to the room list before the API response arrives. On error, it is rolled back with a toast notification.

**User management (admin)**: Create/Delete user operations are optimistic. The UI updates immediately; server errors trigger rollback and error toast.

**Mute toggle**: The local mute state updates instantly in `mediaStore`. The WebSocket `mute-peer` message is sent asynchronously. If the WS connection is closed, the local state still updates for UX consistency.

### 6.5 Streaming and Suspense

Heavy list pages (room list, user list) use React Suspense boundaries with `<Skeleton>` fallbacks. TanStack Query’s `useSuspenseQuery` variant is used in list components to integrate cleanly with Suspense.

The pre-join page uses `loading.tsx` (Next.js Suspense fallback) while server data loads, showing a skeleton of the device setup card.

-----

## 7. Real-Time Communication Architecture

This is the most critical and complex section of the frontend architecture. It covers three interconnected systems: WebSocket signaling, P2P WebRTC, and SFU fallback.

### 7.1 WebSocket Manager

The `WebSocketManager` (`lib/websocket/WebSocketManager.ts`) is a framework-agnostic singleton class:

**Responsibilities:**

- Open/close the WebSocket connection to `GET /ws` (with optional `?token=<jwt>`)
- Reconnect with exponential backoff (initial 1s, max 30s, jitter)
- Serialize and deserialize the JSON envelope protocol
- Route incoming messages to registered type-specific handlers
- Queue messages sent while reconnecting (non-critical messages only; signaling is dropped)
- Emit connection state events (connected/disconnected/reconnecting)

**Connection lifecycle:**

```
1. Created as singleton when meeting room mounts
2. connect(token?) → opens WebSocket
3. On open: dispatch 'join' message with room_id, display_name, host_token
4. On message: route to registered handlers
5. On close (abnormal): schedule reconnect
6. On reconnect: re-join room (new peer_id will be assigned)
7. Destroyed when meeting room unmounts
```

**Reconnection handling:**
The backend does not restore peer identity on reconnect. A reconnected client receives a new `peer_id`. The `useMeetingRoom` hook handles this by:

- Tearing down all existing `RTCPeerConnection` instances
- Clearing the peer map in `meetingStore`
- Re-executing the full join flow
- Re-establishing offers to all peers listed in the new `joined` payload

### 7.2 Signaling Message Router

The `messageRouter` (`lib/websocket/messageRouter.ts`) maps message types to strongly-typed handler callbacks:

```typescript
type MessageHandlers = {
  'joined': (payload: JoinedPayload) => void
  'waiting-approval': (payload: WaitingApprovalPayload) => void
  'join-rejected': (payload: JoinRejectedPayload) => void
  'peer-joined': (payload: PeerJoinedPayload) => void
  'peer-left': (payload: PeerLeftPayload) => void
  'peer-mode-changed': (payload: PeerModeChangedPayload) => void
  'join-request': (payload: JoinRequestPayload) => void
  'offer': (payload: SDPPayload, from: string) => void
  'answer': (payload: SDPPayload, from: string) => void
  'ice-candidate': (payload: ICEPayload, from: string) => void
  'sfu-switch': (payload: SFUSwitchPayload) => void
  'sfu-answer': (payload: SFUAnswerPayload) => void
  'sfu-ice-candidate': (payload: ICEPayload) => void
  'sfu-renegotiate-needed': (payload: SFURenegotiatePayload) => void
  'chat': (payload: ChatPayload, from: string) => void
  'file-offer': (payload: FileOfferPayload, from: string, to: string) => void
  'file-answer': (payload: FileAnswerPayload, from: string) => void
  'mute-request': (payload: MuteRequestPayload, from: string) => void
  'kicked': (payload: KickedPayload) => void
  'room-closed': () => void
  'error': (payload: ErrorPayload) => void
}
```

All type definitions mirror the backend WebSocket protocol exactly as documented in `WEBSOCKET.md`.

### 7.3 P2P Peer Connection Management

**`usePeerConnections`** — the multi-peer orchestrator hook — maintains a `Map<peerId, RTCPeerConnection>` and coordinates the full negotiation lifecycle.

**Perfect Negotiation pattern**: The implementation follows the W3C Perfect Negotiation pattern to handle glare (simultaneous offer scenarios):

- **Polite peer**: The peer with the lexicographically smaller `peer_id` is polite. It rolls back its local description and accepts the remote offer if a glare collision occurs.
- **Impolite peer**: Ignores incoming offers while its own offer is in-flight.

**Per-peer connection lifecycle:**

```
1. peer-joined event received (or existing peers listed in joined payload)
2. Create RTCPeerConnection with ICE servers
3. Add local audio/video tracks from mediaStore.localStream
4. Create data channel "chat" (ordered:true) — for potential P2P chat fallback
5. Create data channel "file-{uuid}" on demand for file transfers
6. If we are the new joiner: create offer → send via WS
7. On remote offer received: set remote description → create answer → send via WS
8. On ICE candidate: send via WS
9. On remote ICE candidate: addIceCandidate
10. On track event: add to peerStore.remoteStreams[peerId]
11. On connection state change: update peer record in meetingStore
12. On peer-left: close connection, remove from map, remove from meetingStore
```

**ICE Server configuration:**

Before `sfu-switch`, the frontend uses STUN only:

```typescript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]
```

After `sfu-switch`, the `turn_servers` array from the payload is merged:

```typescript
const iceServers = [
  ...defaultStunServers,
  ...sfuSwitchPayload.turn_servers  // TURN credentials with HMAC expiry
]
```

**Screen share track replacement:**
When the user starts screen sharing, the existing video sender’s track is replaced using `RTCRtpSender.replaceTrack()` on all active peer connections, avoiding full renegotiation.

### 7.4 Quality Stats Collection

**`useQualityStats`** hook runs a 4-second interval timer. On each tick:

```typescript
async function collectStats(pc: RTCPeerConnection): Promise<QualityStats> {
  const stats = await pc.getStats()
  // Extract outbound-rtp for bitrate_kbps
  // Extract remote-inbound-rtp for packet_loss_pct and rtt_ms
  // Only report after connection has been established for >10s
}
```

The collected stats are averaged across all active peer connections and sent to the backend:

```typescript
wsManager.send({ type: 'stats', payload: { bitrate_kbps, packet_loss_pct, rtt_ms } })
```

Stats are also stored locally for display in `ConnectionQualityIndicator` components.

### 7.5 SFU Fallback Flow

On receiving `sfu-switch`:

```
1. Received: { type: 'sfu-switch', payload: { session_id, turn_servers } }
2. meetingStore.setSFUActive(true)
3. Show SFUBanner to user ("Switching to enhanced network mode")
4. sfuConnection = new RTCPeerConnection({ iceServers: [...stun, ...turn_servers] })
5. Add local audio track to sfuConnection
6. Add local video track to sfuConnection
7. Add recv-only transceivers for each expected remote peer's audio/video
8. offer = await sfuConnection.createOffer()
9. await sfuConnection.setLocalDescription(offer)
10. wsManager.send({ type: 'sfu-offer', payload: { sdp: offer.sdp } })
11. On sfu-answer: sfuConnection.setRemoteDescription(answer)
12. On sfu-ice-candidate: sfuConnection.addIceCandidate(candidate)
13. Send sfuConnection's ICE candidates via sfu-ice-candidate messages
14. On sfuConnection.ontrack: assign remote stream to peer in meetingStore
15. On sfu-renegotiate-needed: create new offer → send sfu-offer (renegotiation loop)
```

**Peer connections in SFU mode:**
When a peer switches to SFU mode (`peer-mode-changed` received), existing direct P2P connections to that peer are closed. Remote tracks for that peer now arrive from the SFU connection’s `ontrack` event instead.

### 7.6 File Transfer Architecture

File transfers use WebRTC DataChannels for byte transport and the backend WebSocket for metadata signaling.

**Send flow:**

```
1. User selects file in FileTransferPanel
2. Validate: size < 500MB (client policy), connection state = connected
3. Generate file_id = crypto.randomUUID()
4. Create DataChannel: pc.createDataChannel(`file-${file_id}`, { ordered: true })
5. Set channel.bufferedAmountLowThreshold = 512 * 1024
6. wsManager.send({ type: 'file-offer', to: targetPeerId, payload: { file_id, name, size, mime } })
7. On file-answer with accepted=true:
   a. Read file chunks (64KB each)
   b. Send JSON: { type: 'file-start', file_id, name, size, mime }
   c. Send ArrayBuffer chunks, pausing when bufferedAmount > 1MB
   d. Resume on channel.onbufferedamountlow
   e. Send JSON: { type: 'file-complete', file_id }
8. Update fileTransferStore progress during send
```

**Receive flow:**

```
1. On file-offer received: show notification in FileTransferPanel
2. User accepts: wsManager.send({ type: 'file-answer', to: senderPeerId, payload: { file_id, accepted: true } })
3. On DataChannel open for this file_id:
   a. On string message { type: 'file-start' }: initialize buffer
   b. On ArrayBuffer: push to chunks[], update progress
   c. On string message { type: 'file-complete' }: reconstruct Blob
4. Create object URL, offer download link
5. Revoke object URL after 5 minutes or on unmount
```

**Backpressure:**

```typescript
// Sender pause logic
if (channel.bufferedAmount > 1 * 1024 * 1024) {
  await new Promise(resolve => {
    channel.onbufferedamountlow = () => resolve(undefined)
  })
}
```

-----

## 8. Authentication & Authorization Flow

### 8.1 Token Architecture

The backend issues two tokens on login:

- **Access token** (JWT, 15-minute TTL): sent as `Authorization: Bearer` header on all protected API requests
- **Refresh token** (opaque, 30-day TTL): used to rotate the access token silently

**Token storage policy:**

|Token          |Storage                              |Rationale                                                                |
|---------------|-------------------------------------|-------------------------------------------------------------------------|
|Access token   |In-memory (`authStore`)              |Not accessible to XSS                                                    |
|Refresh token  |`sessionStorage`                     |Survives page refresh; cleared on tab close; not accessible to other tabs|
|`is_admin` flag|`authStore` (derived from JWT claims)|Drives UI visibility                                                     |

The access token is **never written to `localStorage` or cookies** in the current architecture, as the backend issues bearer tokens without cookie transport.

### 8.2 Login Flow

```
1. User submits LoginForm
2. useMutation → POST /api/auth/login
3. On success:
   a. authStore.setTokens({ accessToken, refreshToken, expiresAt, isAdmin, userId, username })
   b. accessToken stored in authStore (memory)
   c. refreshToken written to sessionStorage['meet_refresh_token']
   d. Navigate to / (or returnUrl if present)
4. On 401: show "Invalid credentials" inline form error
```

### 8.3 Silent Token Refresh

The `apiClient` interceptor handles 401 responses transparently:

```
1. Request with access token → 401 received
2. Read refresh token from sessionStorage
3. POST /api/auth/refresh with { refresh_token }
4. On success: update authStore with new tokens, retry original request
5. On failure (expired/revoked refresh): clear all tokens, navigate to /login
```

The refresh is protected by a singleton in-flight promise to prevent multiple parallel refresh requests when several API calls 401 simultaneously.

### 8.4 App Initialization

On app startup (root layout `useEffect` or a `<AuthInitializer>` component):

```
1. Read refresh token from sessionStorage
2. If present: POST /api/auth/refresh
3. On success: populate authStore (user is logged in)
4. On failure: clear sessionStorage entry (session expired)
5. Render app (auth state is known before first meaningful render)
```

This means the app never flashes a logged-out state for users with a valid session.

### 8.5 Route Protection

**`AuthGuard` component** wraps protected routes:

```typescript
// If not authenticated and route requires auth:
// → redirect to /login?returnUrl=<current-path>
```

Protected route categories:

|Route           |Requirement                                         |
|----------------|----------------------------------------------------|
|`/admin/*`      |`isAdmin === true`                                  |
|`/rooms/new`    |Authenticated (only in private app mode)            |
|`/meet/[roomId]`|No auth required (room-level access control)        |
|`GET /ws`       |No auth required (host_token provides host identity)|

**`host_token` handling**: The host token is stored in a per-room `sessionStorage` entry keyed by `room_id`: `meet_host_token_{roomId}`. It is read during the WebSocket join and passed in the payload. It is never included in the shareable URL.

### 8.6 Role-Based UI Visibility

The `isHost` flag in `meetingStore` and `isAdmin` in `authStore` gate UI elements:

- Host controls (mute/kick buttons) render only when `isHost === true`
- AdmissionModal renders only when `isHost === true` and `pendingApprovals.length > 0`
- Admin panel nav link renders only when `isAdmin === true`
- Room creation in private mode: the form validates token presence before submission

-----

## 9. Routing & Page Structure

### 9.1 Route Map

```
/                           → Home page (room list + create CTA)
/login                      → Login form (auth/user or admin)
/rooms/new                  → Room creation form
/meet/[roomId]              → Pre-join → Meeting (same route, phase-driven UI)
/admin                      → Admin dashboard (live room stats)
/admin/users                → User management
/admin/settings             → App mode settings
/admin/sfu                  → SFU stats (link to GET /api/admin/sfu/stats)
```

### 9.2 Layout Hierarchy

```
app/layout.tsx                  → Root: fonts, ThemeProvider, QueryProvider, ToastProvider
├── app/(auth)/layout.tsx       → Auth shell: centered card layout, no nav
│   └── app/(auth)/login/
└── app/(main)/layout.tsx       → Main shell: TopBar, optional Sidebar
    ├── app/(main)/page.tsx
    └── app/(main)/rooms/new/
app/meet/[roomId]/layout.tsx    → Meeting shell: full-screen, no nav
    └── app/meet/[roomId]/page.tsx
app/admin/layout.tsx            → Admin shell: left sidebar nav
    └── app/admin/*/page.tsx
```

### 9.3 Meeting Page Phase Architecture

The `/meet/[roomId]` route renders different UI based on `meetingStore.meetingPhase`:

```
meetingPhase = 'pre-join'          → PreJoinSetup (device selection, display name, password)
meetingPhase = 'waiting-approval'  → WaitingRoomOverlay (spinner + "waiting for host" message)
meetingPhase = 'in-meeting'        → MeetingRoom (full video grid + controls)
meetingPhase = 'left'              → PostMeetingScreen ("You left the meeting" + rejoin option)
```

This single-route, phase-based architecture avoids the latency of navigation between pre-join and meeting routes and prevents the browser from re-requesting camera permissions on route change.

### 9.4 Loading and Error Boundaries

**`loading.tsx`** for `/meet/[roomId]`:
A skeleton of the pre-join card — avatar placeholder, three device selector skeletons, and a disabled join button.

**`error.tsx`** for `/meet/[roomId]`:
Handles server-side fetch errors with specific UI states:

- Room not found → “This meeting link is invalid or has expired”
- Room locked → “This meeting has been locked by the host”
- Network error → “Could not reach the server. Check your connection.”

Each error state includes a primary CTA (home page link or retry button).

**`not-found.tsx`** (global): Displays a friendly 404 page with navigation back to home.

### 9.5 Parallel Routes & Interception (Future)

For a future enhancement, the chat panel and participants panel can be implemented as parallel routes (`@chatPanel`, `@participantsPanel`) that intercept the main meeting route. This enables independently rendered panels with their own loading states. In the initial implementation, these are rendered as conditional side panels within `MeetingRoom`.

-----

## 10. Styling & Theming Approach

### 10.1 Design Token System

All design decisions are encoded as CSS custom properties in `src/app/globals.css` and mapped to Tailwind configuration in `tailwind.config.ts`.

**Color palette** (Google Meet-inspired):

```css
:root {
  /* Surface */
  --color-bg-primary: #202124;          /* Main background (dark) */
  --color-bg-secondary: #292A2D;        /* Card/panel background */
  --color-bg-elevated: #35363A;         /* Elevated surfaces, modals */
  --color-bg-overlay: rgba(0,0,0,0.6);  /* Video tile overlay */

  /* Brand */
  --color-brand: #8AB4F8;               /* Google Blue (dark mode) */
  --color-brand-hover: #AAC9FB;
  --color-brand-active: #6B9EF7;

  /* Semantic */
  --color-success: #81C995;
  --color-warning: #FDD663;
  --color-error: #F28B82;
  --color-muted: #9AA0A6;

  /* Text */
  --color-text-primary: #E8EAED;
  --color-text-secondary: #9AA0A6;
  --color-text-disabled: #5F6368;

  /* Control bar */
  --color-control-bg: #3C3F43;
  --color-control-hover: #4A4D52;
  --color-control-active: #5F6368;
  --color-control-danger: #EA4335;
  --color-control-danger-hover: #CC3327;
}

[data-theme="light"] {
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F8F9FA;
  --color-bg-elevated: #F1F3F4;
  --color-brand: #1A73E8;
  --color-text-primary: #202124;
  --color-text-secondary: #5F6368;
  /* ... */
}
```

**Typography scale:**

```css
--font-size-xs:   0.75rem;    /* 12px — badge labels */
--font-size-sm:   0.875rem;   /* 14px — secondary text */
--font-size-base: 1rem;       /* 16px — body text */
--font-size-lg:   1.125rem;   /* 18px — room names */
--font-size-xl:   1.25rem;    /* 20px — headings */
--font-size-2xl:  1.5rem;     /* 24px — page titles */
```

**Spacing scale:** 4px base unit, following 4/8/12/16/24/32/48/64px steps.

**Border radius:**

```css
--radius-sm:   4px;    /* Badges, chips */
--radius-md:   8px;    /* Cards, inputs */
--radius-lg:   12px;   /* Modals, panels */
--radius-full: 9999px; /* Pills, avatar rings */
```

### 10.2 Dark Mode (Default)

The meeting room UI is **dark by default**, matching Google Meet’s approach. Video tiles on dark backgrounds provide better contrast and visual focus. Light mode is available for admin and pre-join pages where document-like readability is preferred.

Theme is toggled by setting `data-theme` attribute on `<html>`. The `ThemeProvider` reads from `localStorage['meet_theme']` and applies on first render to avoid flash of wrong theme.

### 10.3 Responsive Design

The application targets three breakpoints:

|Breakpoint           |Layout behavior                                                     |
|---------------------|--------------------------------------------------------------------|
|Mobile (<640px)      |Single column tile, chat panel full-screen overlay, reduced controls|
|Tablet (640px–1024px)|2-column tile grid, side panels 320px wide                          |
|Desktop (>1024px)    |Flexible tile grid, side panels 360px wide                          |

**Video grid layout**: Uses CSS Grid with `auto-fill` and dynamic `minmax` tile sizing:

- 1 participant: single large tile (full viewport minus control bar)
- 2 participants: 2-column split
- 3–4 participants: 2×2 grid
- 5–9 participants: 3×3 grid with overflow scrolling
- 10+ participants: 4-column grid with pagination or scroll

### 10.4 Component Animation Guidelines

- **Join/leave transitions**: Tile enters with `opacity: 0 → 1` + `scale: 0.95 → 1` (200ms ease-out)
- **Panel slide-in**: Chat/Participants panels translate from right `translateX(100%) → translateX(0)` (250ms ease-out)
- **Modal entrance**: Scale from 0.95 + fade in (150ms)
- **Control bar tooltips**: Fade in (100ms)
- **Loading skeleton**: Shimmer animation (1.5s infinite)

All animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

-----

## 11. Performance Optimization

### 11.1 Bundle Strategy

**Dynamic imports for heavy meeting components:**

```typescript
const MeetingRoom = dynamic(() => import('@/features/meeting/components/MeetingRoom'), {
  loading: () => <MeetingRoomSkeleton />,
  ssr: false  // WebRTC must not SSR
})
```

The meeting room bundle (WebRTC, media APIs, peer connection logic) is code-split from the main bundle and loaded only when entering a meeting.

**Route-level code splitting** is automatic via Next.js App Router. Each `page.tsx` is a split point.

**Admin bundle isolation**: Admin components are in a separate chunk and never loaded for non-admin users.

### 11.2 Rendering Optimization

**`React.memo`**: All video tile components are memoized. A single peer’s stats updating should not re-render other tiles.

**Selector-based Zustand subscriptions**: Components subscribe to the minimal store slice they need:

```typescript
// BAD: re-renders on any store change
const store = useMeetingStore()
// GOOD: re-renders only when peers changes
const peers = useMeetingStore(state => state.peers)
```

**`useCallback` and `useMemo`**: Used in hooks that produce functions/objects consumed by memoized child components.

**Video element management**: `<video>` elements are assigned `srcObject` via ref, never via state. Changing a MediaStream reference does not cause React re-renders.

### 11.3 Media Performance

**Audio levels**: The mic level visualizer uses a Web Audio `AnalyserNode` on the local stream. It runs a `requestAnimationFrame` loop outside React state to update a canvas element directly — zero React renders per frame.

**WebRTC stats processing**: The `getStats()` call and data processing runs in a Web Worker (`statsWorker.ts`) to avoid blocking the main thread.

**Video tile rendering**: Remote `<video>` elements use `playsinline`, `autoplay`, and `muted` (for remote audio, audio is unmuted). They do not participate in React’s reconciliation after mount.

### 11.4 Core Web Vitals Targets

|Metric |Target |Strategy                                            |
|-------|-------|----------------------------------------------------|
|LCP    |< 2.5s |SSR for pre-join page, preloaded fonts              |
|FID/INP|< 200ms|Offload stats to Web Worker, minimal event listeners|
|CLS    |< 0.1  |Fixed-height tile grid, skeleton placeholders       |
|TTFB   |< 800ms|Vercel Edge network / CDN for static assets         |

### 11.5 Asset Optimization

- **Fonts**: Self-hosted `Google Sans` (or `Inter` as fallback) with `font-display: swap`
- **Icons**: SVG sprite sheet loaded once; individual icons reference `<use xlink:href>`
- **Images**: `next/image` for all static images; `sizes` attribute for responsive images
- **Audio**: Join/leave chime sounds preloaded via `<link rel="preload">` in the meeting layout

-----

## 12. Accessibility (a11y)

### 12.1 Semantic HTML and ARIA

- **Meeting control buttons**: Each control (mic, camera, screen share) uses `<button>` with `aria-label="Mute microphone"` / `aria-label="Unmute microphone"` toggling on state change
- **Video tiles**: Wrapped in `<article>` with `aria-label="{displayName}'s video"`
- **Chat panel**: Uses `role="log"` and `aria-live="polite"` for the message list
- **Admission modal**: Uses `role="dialog"` with `aria-labelledby` and focus trap
- **Connection quality**: `aria-label="Connection quality: good"` on the indicator dot
- **Participant count**: `aria-live="polite"` region announces join/leave events

### 12.2 Keyboard Navigation

- All interactive elements are keyboard-accessible
- Meeting controls: `M` (mute), `V` (camera), `S` (screen share), `C` (chat) as keyboard shortcuts, shown in tooltips
- Tab order in the control bar follows logical left-to-right
- Escape closes open panels and modals
- `Enter`/`Space` on video tiles triggers focus-mode (pin tile)

### 12.3 Screen Reader Considerations

- Video tile overlay text is `aria-hidden="false"` even when visually hidden by video
- Status changes (mute/unmute, participant join/leave) are announced via a live region
- File transfer offers are announced: “File offer: report.pdf from Alice. Accept or reject.”
- Loading states use `aria-busy="true"` on their container elements

### 12.4 Color and Contrast

- All text passes WCAG AA (4.5:1 for normal text, 3:1 for large text) in both light and dark modes
- Error states use both color and an icon (not color alone)
- Focus indicators are high-contrast outlines (2px, `--color-brand`)
- Video tile participant names use a semi-transparent dark background scrim for contrast over video

### 12.5 Reduced Motion

All animations conditional on `prefers-reduced-motion`. Tile transitions become instant. Loading spinner replaces animated skeleton shimmer with static placeholder.

-----

## 13. Testing Strategy

### 13.1 Unit Tests (Vitest)

**What to unit test:**

- `WebSocketManager`: connection lifecycle, reconnection logic, message routing
- `messageRouter`: type-safe dispatch, handler registration/deregistration
- Zustand stores: action correctness, state transitions
- `apiClient`: token injection, 401 handling, refresh rotation
- `statsCollector`: bitrate/loss/RTT extraction from `RTCStatsReport` fixtures
- Utility functions: formatters, validators, `cn()`
- Auth token storage: read/write/clear flows

**Test environment**: `jsdom` for browser API simulation. `vi.mock` for WebSocket and RTCPeerConnection globals.

### 13.2 Component Integration Tests (Vitest + RTL + MSW)

**What to integration test:**

- `LoginForm`: submission, validation errors, 401 response
- `RoomCreationForm`: field validation, successful submission, navigation
- `PreJoinSetup`: device selector population, display name validation
- `AdmissionModal`: renders pending requests, approval/rejection sends correct WS messages (using WS mock)
- `ChatPanel`: renders history, sends chat message, displays incoming message
- `FileTransferItem`: accept/reject flow, progress display
- `ParticipantItem` (host view): mute/kick button actions trigger correct WS messages
- `ControlBar`: toggle states, keyboard shortcuts

**MSW handlers** mock all REST endpoints. A `MockWebSocketServer` utility simulates WS message sequences.

### 13.3 End-to-End Tests (Playwright)

E2E tests run against the real backend (Docker Compose) or a mock server. Browser permissions are granted via Playwright’s `grantPermissions` API.

**Critical E2E scenarios:**

```
1. Public Room Create and Join
   - Home page → Create room (open policy)
   - Copy join link
   - Second browser context opens link → enters display name → joins
   - Verify both participants see each other's tiles

2. Approval Flow
   - Create room with approval policy
   - Guest opens link → sees waiting screen
   - Host sees admission modal → approves
   - Guest enters meeting

3. Host Moderation
   - Host mutes participant → participant's mic indicator shows muted
   - Host kicks participant → participant sees kicked overlay
   - Other participants see peer-left notification

4. Private Mode Room Creation
   - Admin sets app_mode = private
   - Unauthenticated user visits /rooms/new → redirected to /login
   - Logged-in user creates room successfully

5. File Transfer
   - User A sends file to User B
   - User B accepts → progress bar appears → download offered on completion

6. SFU Fallback UI
   - Simulate poor stats report from client
   - Verify SFUBanner appears when sfu-switch received

7. Admin User Management
   - Admin login
   - Create user → appears in list
   - Edit user → name updated
   - Delete user → removed from list

8. Token Refresh
   - Login, wait for access token near expiry (mocked)
   - Make API request → 401 → silent refresh → request retried successfully
```

### 13.4 WebRTC Testing Approach

WebRTC is the hardest layer to test. The strategy:

- **Unit level**: Test `usePeerConnection` hook with `RTCPeerConnection` mocked to return predictable events
- **Integration level**: Use Playwright’s built-in fake media (`--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`) to avoid hardware requirements
- **E2E level**: Two Playwright browser contexts (same machine) can establish real WebRTC connections using loopback ICE candidates. This validates the full offer/answer/ICE flow without a live network.

### 13.5 Coverage Targets

|Layer                    |Coverage Target         |
|-------------------------|------------------------|
|Zustand stores           |95%                     |
|API client / interceptors|90%                     |
|WebSocket manager        |90%                     |
|Feature hooks            |80%                     |
|UI components            |70%                     |
|E2E critical paths       |100% of listed scenarios|

-----

## 14. CI/CD & Deployment Pipeline

### 14.1 GitHub Actions Workflows

**`ci.yml`** (triggers: PR, push to main):

```yaml
jobs:
  quality:
    steps:
      - pnpm install
      - pnpm typecheck        # tsc --noEmit
      - pnpm lint             # ESLint
      - pnpm test:unit        # Vitest unit + integration
      - pnpm build            # Next.js production build (catches build-time errors)

  e2e:
    needs: quality
    services:
      - meet-backend (Docker)
    steps:
      - pnpm install
      - pnpm test:e2e         # Playwright
```

**`deploy.yml`** (triggers: push to main):

```yaml
jobs:
  deploy-staging:
    steps:
      - Deploy to Vercel Preview (automatic) or staging server

  deploy-production:
    needs: deploy-staging
    if: manual approval required
    steps:
      - Deploy to Vercel Production
```

### 14.2 Environment Management

Three environments with separate Next.js environment files:

|Environment|File             |Backend URL                           |
|-----------|-----------------|--------------------------------------|
|Local dev  |`.env.local`     |`http://localhost:8080`               |
|Staging    |`.env.staging`   |`https://api-staging.meet.example.com`|
|Production |`.env.production`|`https://api.meet.example.com`        |

**Required environment variables:**

```env
NEXT_PUBLIC_API_URL=https://api.meet.example.com
NEXT_PUBLIC_WS_URL=wss://api.meet.example.com
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_SENTRY_DSN=https://...
```

Only `NEXT_PUBLIC_*` variables are exposed to the browser. Backend credentials are never in the frontend bundle.

### 14.3 Deployment Architecture

**Recommended: Vercel**

- Zero-config Next.js deployment
- Automatic preview deployments per PR
- Edge network for static assets
- Environment variable management per environment

**Alternative: Docker + Nginx**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Nginx config (WebSocket proxying for the API):

```nginx
location /ws {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### 14.4 Release Strategy

- **Semantic versioning**: All releases tagged (v1.0.0, v1.1.0, etc.)
- **Feature flags**: New meeting features gated behind `NEXT_PUBLIC_FEATURE_*` environment variables for gradual rollout
- **Rollback**: Vercel enables one-click rollback to any previous deployment
- **Bundle analysis**: `@next/bundle-analyzer` runs on every production build; bundle size regressions block deploy

-----

## 15. UI/UX Guidelines

### 15.1 Overall Design Language

Meet’s UI is inspired by Google Meet’s dark-first, video-centric aesthetic. The design principles are:

- **Video is primary**: The meeting room is 100% viewport height and width. Controls are minimal and auto-hide.
- **Information density without clutter**: Participant names, mute indicators, and quality dots sit inside tiles. No floating panels compete for space unless explicitly opened.
- **Purposeful color**: Color communicates state (green = active/on, red = muted/danger, blue = interactive). Decorative color is minimal.
- **Responsive by default**: The layout adapts gracefully from a single phone camera view to a 25-participant grid.

### 15.2 Pre-Join Screen

The pre-join screen follows a card-based layout with two sections: a left camera preview and a right configuration panel.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  ← Room: "Team Sync"              🔒 Has Password   │
├───────────────────────┬─────────────────────────────┤
│                       │  Join the meeting           │
│   📷 Camera Preview   │                             │
│   (mirrored, rounded) │  Your name                  │
│                       │  [Sara                    ] │
│   ● ● ●               │                             │
│  (mic level bars)     │  Camera: [Built-in FaceTime]│
│                       │  Mic: [Built-in Microphone] │
│                       │                             │
│                       │  🎤 🎥  (quick toggles)     │
│                       │                             │
│                       │  [        Join now         ]│
└───────────────────────┴─────────────────────────────┘
```

**Key UX behaviors:**

- Camera preview starts immediately as soon as the page loads — user sees themselves before joining
- If camera permission is denied, the preview shows a dark tile with camera-off icon and a contextual help message (“Enable camera in browser settings →”)
- The join button is disabled until display name is entered
- For password-protected rooms, a password input appears above the join button
- For approval rooms, a subtle note: “Someone in the meeting will let you in”
- Selecting “Join without camera/mic” shows `audioEnabled: false, videoEnabled: false` state visually before joining

### 15.3 Waiting Room Screen

Shown when `meetingPhase === 'waiting-approval'`.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              ⏳                                      │
│                                                     │
│     Waiting for someone to let you in               │
│                                                     │
│   Your name: Sara                                   │
│                                                     │
│   ●  Connected and waiting...                       │
│                                                     │
│              [Cancel]                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- Animated pulsing dots to indicate active waiting (not frozen)
- Room name shown for context
- Cancel closes the WebSocket and returns to pre-join
- If host is not yet in the room, show: “No one else is here yet. You’ll join automatically when someone lets you in.”

### 15.4 Host Admission Modal

Shown when `join-request` arrives and host is in meeting.

```
┌─────────────────────────┐
│  Someone wants to join  │
│                         │
│  👤 Sara                │
│  Waiting...             │
│                         │
│  [Deny]   [Admit]       │
└─────────────────────────┘
```

- Notification sound plays on new join request
- If multiple requests are queued, they stack in a list above the modal
- Admit/Deny actions have visual confirmation (button spinners)
- Keyboard shortcuts: `A` to admit, `D` to deny when modal is focused

### 15.5 Meeting Room Layout

**Default state (in-meeting):**

```
┌───────────────────────────────────────────────────────────┐
│                                                     ● 4   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │              │  │              │  │              │    │
│  │   [Video]    │  │   [Video]    │  │   [Video]    │    │
│  │              │  │              │  │              │    │
│  │ ● Ali    🔇  │  │ ● Sara       │  │ ● Carlos     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │   [Video]    │  │  [You]       │                      │
│  │              │  │  (mirrored)  │                      │
│  │ ● Priya  👑  │  │ ● You        │                      │
│  └──────────────┘  └──────────────┘                      │
│                                                           │
│  ══════════════════════════════════════════════════════   │
│  🎤  📷  💻  |  💬  👥  📁  |  ⋮         [Leave call]   │
└───────────────────────────────────────────────────────────┘
```

**Tile anatomy:**

- Video stream fills the tile (object-fit: cover)
- Bottom-left: display name + host crown (👑) if host
- Bottom-right: mute indicators (🔇 for audio, 📷 for video off)
- Top-right: connection quality dot (green/yellow/red) — visible on hover
- When video is off: dark background with large initials avatar

**Control bar (bottom):**

|Icon      |Action                                 |Keyboard|
|----------|---------------------------------------|--------|
|🎤 / 🔇     |Toggle microphone                      |`M`     |
|📷 / 📷❌    |Toggle camera                          |`V`     |
|💻 / ❌     |Screen share                           |`S`     |
|💬         |Chat panel (badge shows unread count)  |`C`     |
|👥         |Participants panel                     |`P`     |
|📁         |File share panel                       |        |
|⋮         |More options (settings, report, layout)|        |
|Leave call|Destructive red button                 |        |

Controls auto-hide after 4 seconds of inactivity, fade back in on cursor movement or any keyboard input.

### 15.6 Chat Panel

Slides in from the right (360px wide, full height):

```
┌─────────────────────────┐
│  In-call messages  ✕    │
├─────────────────────────┤
│  Ali  10:32             │
│  Hello everyone         │
│                         │
│  Sara  10:33            │
│  Hi! Can you hear me?   │
│                         │
│  ↑ Today (loaded from   │
│     server history)     │
├─────────────────────────┤
│  [  Message...     ] ➤  │
└─────────────────────────┘
```

- History loaded from `GET /api/rooms/{id}/chat` on open
- New messages arrive via WebSocket, appended at bottom with auto-scroll
- Timestamps shown as relative (“just now”, “2 min ago”)
- Unread badge on chat toggle button clears when panel is opened
- Sending a message also scrolls to the new message

### 15.7 Participants Panel

Slides in from the right:

```
┌─────────────────────────┐
│  Participants (4)  ✕    │
├─────────────────────────┤
│  In the call            │
│  👑 Ali (Host)     ⋮    │
│  ● Sara            ⋮    │
│  ● Carlos    🔇    ⋮    │
│  ● You (me)             │
│                         │
│  Waiting (1)            │
│  ● Guest123             │
│  [Admit] [Deny]         │
└─────────────────────────┘
```

- Host sees 3-dot menu per participant: Mute audio, Mute video, Remove
- Muted participants show 🔇 icon
- Waiting section shows pending approvals inline (host only)
- “You (me)” row is always last and non-interactive for host actions

### 15.8 File Sharing Panel

Accessible from the 📁 button in the control bar:

```
┌─────────────────────────┐
│  Share files  ✕         │
├─────────────────────────┤
│  Send to: [Sara     ▾]  │
│  [  Drop file or click] │
│                         │
│  Recent transfers       │
│  ─────────────────────  │
│  📄 report.pdf → Sara   │
│  ████████░░  80%  ✓     │
│                         │
│  📄 data.csv ← Carlos   │
│  [Accept] [Decline]     │
└─────────────────────────┘
```

- Drag-and-drop file area with visual hover state
- File offer notification appears as a toast: “Carlos wants to send you data.csv (2.1 MB). [Accept] [Decline]”
- Progress bars update in real-time during transfer
- Completed transfers show a download link that expires after 5 minutes
- File sizes > 500MB show a warning and prevent sending

### 15.9 SFU Fallback Banner

Non-intrusive banner appearing below the control bar when `sfuActive === true`:

```
│  ⚠ Network quality optimized — using enhanced relay mode │
```

- Yellow warning color, 32px height
- Fades in smoothly (no layout shift)
- Dismissable with ✕ but reappears if still in SFU mode after 30s
- Does not disrupt video layout

### 15.10 Error and Edge States

|State                 |UI Behavior                                                                                             |
|----------------------|--------------------------------------------------------------------------------------------------------|
|Room not found        |Full-page error card: “This meeting link is invalid or has expired.” + Home button                      |
|Room full             |Pre-join error: “This meeting has reached its maximum capacity.”                                        |
|Room password wrong   |Inline form error: “Incorrect meeting password.” with shake animation                                   |
|Kicked                |Full-screen overlay: “You were removed from the meeting.” + optional reason + Home button               |
|Room closed           |Full-screen overlay: “This meeting has ended.” + option to create a new meeting                         |
|Join rejected         |Pre-join redirect: “Your request to join was declined.”                                                 |
|WebSocket disconnected|Toast: “Reconnecting…” with spinner. Auto-reconnect in background. On success: “Reconnected.”           |
|Camera/mic denied     |Pre-join: inline help card with browser-specific instructions                                           |
|Peer connection failed|Per-tile: spinner overlay while ICE negotiates; after 15s timeout: “Video unavailable” with retry button|
|Network offline       |Global banner: “No internet connection.” Controls disabled.                                             |

### 15.11 Onboarding Considerations

For first-time visitors:

1. **Display name persistence**: Pre-fill from `localStorage['meet_display_name']` if present
1. **Device permission prompt**: The browser’s native permission dialog is triggered by clicking “Test camera/mic” before join — this avoids a jarring permission popup mid-join
1. **Tooltip hints**: On first meeting join, tooltip overlays briefly explain each control button (dismissed on first use, stored in `localStorage['meet_hints_dismissed']`)
1. **Empty room state**: When the host joins first and no participants are present, show: “Share this link to invite people” with a copy-link button prominently displayed in the center of the tile grid area

### 15.12 Micro-interactions

- **Mic toggle**: The microphone icon animates with a strikethrough line drawing (200ms) when muting, not just swapping icons
- **Volume indicator**: A subtle ring animation pulses around a tile’s avatar/video when that participant is speaking (driven by audio level detection)
- **Participant join**: A soft audio chime plays and a toast “Sara joined” appears for 3 seconds
- **Participant leave**: A softer audio chime; toast “Carlos left”
- **File transfer complete**: Checkmark animates in on the transfer row
- **Copy link button**: Copies to clipboard, button label briefly changes to “Copied!” (1.5s) before reverting
- **Leave button hover**: Color transitions from neutral to destructive red (150ms), signaling finality

-----

*End of Meet Frontend Architecture Specification v1.0*

*This document should be reviewed by the frontend lead, backend integration owner, and a QA engineer before implementation begins. All WebSocket message type definitions in Section 7 must be validated against the live backend documentation at the start of each sprint to ensure protocol parity.*