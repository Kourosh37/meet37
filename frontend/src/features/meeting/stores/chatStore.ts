import type { ChatHistoryItem } from "@/types/api";
import { create } from "zustand";

export interface ChatMessageRecord {
  displayName: string;
  id: string;
  peerId?: string;
  text: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessageRecord[];
  unreadCount: number;
  appendMessage: (message: ChatMessageRecord, countUnread?: boolean) => void;
  clearUnread: () => void;
  loadHistory: (messages: ChatHistoryItem[]) => void;
  reset: () => void;
}

function fromHistory(item: ChatHistoryItem): ChatMessageRecord {
  return {
    displayName: item.display_name,
    id: `history-${item.id}`,
    peerId: item.peer_id,
    text: item.text,
    timestamp: item.ts * 1000
  };
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  unreadCount: 0,

  appendMessage: (message, countUnread = true) =>
    set((state) => ({
      messages: [...state.messages, message],
      unreadCount: countUnread ? state.unreadCount + 1 : state.unreadCount
    })),

  clearUnread: () => set({ unreadCount: 0 }),

  loadHistory: (messages) =>
    set((state) => {
      const byId = new Map(
        state.messages.map((message) => [message.id, message])
      );

      messages
        .slice()
        .sort((a, b) => a.ts - b.ts)
        .map((message) => fromHistory(message))
        .forEach((message) => byId.set(message.id, message));

      return {
        messages: [...byId.values()].sort(
          (left, right) => left.timestamp - right.timestamp
        ),
        unreadCount: state.unreadCount
      };
    }),

  reset: () => set({ messages: [], unreadCount: 0 })
}));
