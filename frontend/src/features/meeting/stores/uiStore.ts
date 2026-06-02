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
