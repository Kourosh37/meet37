import { useChatStore } from "@/features/meeting/stores/chatStore";
import { useFileTransferStore } from "@/features/meeting/stores/fileTransferStore";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { useMeetingUiStore } from "@/features/meeting/stores/uiStore";
import { describe, expect, it, beforeEach } from "vitest";

beforeEach(() => {
  useChatStore.getState().reset();
  useFileTransferStore.getState().reset();
  useMeetingStore.getState().reset();
  useMeetingUiStore.getState().reset();
});

describe("meetingStore", () => {
  it("moves joined payloads into in-call state and tracks peer mode changes", () => {
    useMeetingStore.getState().beginJoin("room-1");
    useMeetingStore.getState().joined({
      is_host: true,
      mode: "sfu",
      peers: [
        {
          display_name: "Guest",
          id: "peer-2",
          is_host: false,
          mode: "sfu"
        }
      ],
      your_id: "peer-1"
    });
    useMeetingStore.getState().setPeerMode("peer-2", "sfu");

    const state = useMeetingStore.getState();
    expect(state.phase).toBe("in-call");
    expect(state.isHost).toBe(true);
    expect(state.peers["peer-2"]?.connection.mode).toBe("sfu");
  });

  it("clears pending peers after approval or rejection", () => {
    useMeetingStore.getState().addJoinRequest({
      display_name: "Waiting guest",
      peer_id: "peer-waiting"
    });
    expect(useMeetingStore.getState().pendingPeers).toHaveLength(1);

    useMeetingStore.getState().removePendingPeer("peer-waiting");
    expect(useMeetingStore.getState().pendingPeers).toHaveLength(0);
  });

  it("stops a failed join attempt and keeps the user on prejoin", () => {
    useMeetingStore.getState().beginJoin("room-1");
    useMeetingStore.getState().waitingApproval("pending-peer");

    useMeetingStore
      .getState()
      .failJoin("That display name is already in this room.");

    const state = useMeetingStore.getState();
    expect(state.phase).toBe("idle");
    expect(state.error).toBe("That display name is already in this room.");
    expect(state.localPeerId).toBeNull();
    expect(state.roomId).toBe("room-1");
  });
});

describe("chatStore", () => {
  it("loads history oldest first and tracks unread live messages", () => {
    useChatStore.getState().loadHistory([
      {
        display_name: "B",
        id: 2,
        peer_id: "peer-2",
        room_id: "room-1",
        text: "second",
        ts: 20,
        user_id: "user-2"
      },
      {
        display_name: "A",
        id: 1,
        peer_id: "peer-1",
        room_id: "room-1",
        text: "first",
        ts: 10,
        user_id: "user-1"
      }
    ]);
    useChatStore.getState().appendMessage({
      displayName: "C",
      id: "live-1",
      text: "live",
      timestamp: 30_000
    });

    expect(
      useChatStore.getState().messages.map((message) => message.text)
    ).toEqual(["first", "second", "live"]);
    expect(useChatStore.getState().unreadCount).toBe(1);
    useChatStore.getState().clearUnread();
    expect(useChatStore.getState().unreadCount).toBe(0);
  });
});

describe("fileTransferStore", () => {
  it("updates progress and creates completed download records", () => {
    useFileTransferStore.getState().addOrUpdateTransfer({
      createdAt: 1,
      direction: "incoming",
      fileId: "file-1",
      mime: "text/plain",
      name: "notes.txt",
      progress: {
        bytesTransferred: 0,
        fileId: "file-1",
        percentage: 0,
        totalBytes: 100
      },
      senderPeerId: "peer-1",
      size: 100,
      status: "accepted",
      targetPeerId: "peer-2"
    });

    useFileTransferStore.getState().updateProgress("file-1", 50);
    expect(
      useFileTransferStore.getState().transfers["file-1"]?.progress.percentage
    ).toBe(50);

    useFileTransferStore.getState().completeTransfer("file-1", "blob:download");
    const transfer = useFileTransferStore.getState().transfers["file-1"];
    expect(transfer?.status).toBe("completed");
    expect(transfer?.objectUrl).toBe("blob:download");
    expect(transfer?.progress.percentage).toBe(100);
  });

  it("keeps active runtime transfers when file history is refreshed", () => {
    useFileTransferStore.getState().addOrUpdateTransfer({
      createdAt: 2,
      direction: "incoming",
      fileId: "file-live",
      mime: "text/plain",
      name: "live.txt",
      objectUrl: "blob:live",
      progress: {
        bytesTransferred: 100,
        fileId: "file-live",
        percentage: 100,
        totalBytes: 100
      },
      senderPeerId: "peer-1",
      size: 100,
      status: "completed",
      targetPeerId: "peer-2"
    });

    useFileTransferStore.getState().loadHistory([
      {
        file_id: "file-live",
        id: 1,
        mime: "text/plain",
        name: "history.txt",
        room_id: "room-1",
        sender_peer_id: "peer-1",
        size: 100,
        reason: "",
        status: "offered",
        target_peer_id: "peer-2",
        ts: 1
      }
    ]);

    const transfer = useFileTransferStore.getState().transfers["file-live"];
    expect(transfer?.name).toBe("live.txt");
    expect(transfer?.objectUrl).toBe("blob:live");
    expect(transfer?.status).toBe("completed");
  });
});

describe("meetingUiStore", () => {
  it("toggles visual panels independently from meeting state", () => {
    useMeetingUiStore.getState().togglePanel("chat");
    expect(useMeetingUiStore.getState().chatOpen).toBe(true);
    expect(useMeetingUiStore.getState().activePanel).toBe("chat");

    useMeetingUiStore.getState().openPanel("settings");
    expect(useMeetingUiStore.getState().settingsOpen).toBe(true);
    expect(useMeetingUiStore.getState().chatOpen).toBe(false);
    expect(useMeetingUiStore.getState().activePanel).toBe("settings");

    useMeetingUiStore.getState().openPanel("chat");
    expect(useMeetingUiStore.getState().chatOpen).toBe(true);
    expect(useMeetingUiStore.getState().settingsOpen).toBe(false);
    expect(useMeetingUiStore.getState().participantsOpen).toBe(true);
    expect(useMeetingUiStore.getState().activePanel).toBe("chat");

    useMeetingUiStore.getState().closePanel("chat");
    expect(useMeetingUiStore.getState().chatOpen).toBe(false);
    expect(useMeetingUiStore.getState().activePanel).toBeNull();
  });
});
