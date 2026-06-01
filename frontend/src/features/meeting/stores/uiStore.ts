/*
Frontend architecture note

File: src\features\meeting\stores\uiStore.ts
Layer: Meeting Runtime

Responsibility:
- Frontend file for the Meeting Runtime layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: WebSocket signaling endpoint described in backend/docs/WEBSOCKET.md plus room metadata from GET /api/rooms/{id}. The join payload must include display_name and may include password and host_token.

State model to plan: idle, prejoining, waiting-approval, joining, in-call, reconnecting, sfu-active, kicked, rejected, room-closed, media-error, and left.

UX and edge cases to plan:
- Display clear loading and empty states instead of rendering nothing once implementation starts.
- Normalize backend errors into user-safe messages while preserving technical details for logger.ts.
- Keep room links shareable; never require global login just to open an existing meeting link.
- In private app mode, require login only for room creation, not for joining a shared room link.
- Every meeting participant must provide a non-empty display name before joining.

Security and privacy notes:
- Never expose refresh tokens to arbitrary components; use the storage/auth layer only.
- Treat host_token as room-scoped moderation authority and avoid leaking it into URLs or logs.
- Do not persist raw media streams, SDP blobs, ICE candidates, or file bytes unless a later backend feature explicitly requires it.

Future tests: WebSocket join flow, approval room flow, host approve/reject, kick/mute messages, P2P signaling, SFU switch handling, chat/file events, and cleanup on leave.

*/

import { create } from "zustand";

export type MeetingPanel = "chat" | "participants" | "settings";

export interface MeetingUiState {
  chatOpen: boolean;
  participantsOpen: boolean;
  settingsOpen: boolean;
  activePanel: MeetingPanel | null;
  closePanel: (panel: MeetingPanel) => void;
  openPanel: (panel: MeetingPanel) => void;
  setPanelOpen: (panel: MeetingPanel, open: boolean) => void;
  togglePanel: (panel: MeetingPanel) => void;
  reset: () => void;
}

const initialState = {
  activePanel: null,
  chatOpen: false,
  participantsOpen: true,
  settingsOpen: false
};

function stateForPanel(panel: MeetingPanel, open: boolean) {
  switch (panel) {
    case "chat":
      return { chatOpen: open };
    case "participants":
      return { participantsOpen: open };
    case "settings":
      return { settingsOpen: open };
  }
}

export const useMeetingUiStore = create<MeetingUiState>((set) => ({
  ...initialState,

  closePanel: (panel) =>
    set((state) => ({
      ...stateForPanel(panel, false),
      activePanel: state.activePanel === panel ? null : state.activePanel
    })),

  openPanel: (panel) =>
    set({
      ...stateForPanel(panel, true),
      activePanel: panel
    }),

  reset: () => set(initialState),

  setPanelOpen: (panel, open) =>
    set((state) => ({
      ...stateForPanel(panel, open),
      activePanel: open
        ? panel
        : state.activePanel === panel
          ? null
          : state.activePanel
    })),

  togglePanel: (panel) =>
    set((state) => {
      const currentlyOpen =
        panel === "chat"
          ? state.chatOpen
          : panel === "participants"
            ? state.participantsOpen
            : state.settingsOpen;

      return {
        ...stateForPanel(panel, !currentlyOpen),
        activePanel: currentlyOpen ? null : panel
      };
    })
}));
