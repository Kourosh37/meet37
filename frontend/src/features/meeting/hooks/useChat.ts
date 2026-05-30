"use client";

import { useCallback, useEffect, useState } from "react";
import { getRoomChat } from "@/features/rooms/api/roomsApi";
import { useChatStore } from "@/features/meeting/stores/chatStore";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { webSocketManager } from "@/lib/websocket/WebSocketManager";

export function useChat(roomId: string | null, isOpen: boolean) {
  const messages = useChatStore((state) => state.messages);
  const unreadCount = useChatStore((state) => state.unreadCount);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const clearUnread = useChatStore((state) => state.clearUnread);
  const loadHistory = useChatStore((state) => state.loadHistory);
  const localPeerId = useMeetingStore((state) => state.localPeerId);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    let cancelled = false;
    setIsLoadingHistory(true);

    getRoomChat(roomId)
      .then((history) => {
        if (!cancelled) {
          loadHistory(history);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadHistory, roomId]);

  useEffect(() => {
    if (isOpen) {
      clearUnread();
    }
  }, [clearUnread, isOpen]);

  useEffect(() => {
    return webSocketManager.subscribe("chat", (message) => {
      const meetingState = useMeetingStore.getState();
      const peer = message.from ? meetingState.peers[message.from] : undefined;
      appendMessage(
        {
          displayName:
            message.from === meetingState.localPeerId
              ? "You"
              : (peer?.displayName ?? "Participant"),
          id: `live-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          peerId: message.from,
          text: message.payload.text,
          timestamp: Date.now()
        },
        !isOpen
      );
    });
  }, [appendMessage, isOpen]);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    webSocketManager.send({ payload: { text: trimmed }, type: "chat" });
    appendMessage(
      {
        displayName: "You",
        id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        peerId: localPeerId ?? undefined,
        text: trimmed,
        timestamp: Date.now()
      },
      false
    );
  }, [appendMessage, localPeerId]);

  return {
    clearUnread,
    isLoadingHistory,
    messages,
    sendMessage,
    unreadCount
  };
}
