import { useChatStore } from "@/features/meeting/stores/chatStore";
import { useFileTransferStore } from "@/features/meeting/stores/fileTransferStore";
import { useMeetingStore } from "@/features/meeting/stores/meetingStore";
import { describe, expect, it, beforeEach } from "vitest";

beforeEach(() => {
  useChatStore.getState().reset();
  useFileTransferStore.getState().reset();
  useMeetingStore.getState().reset();
});

describe("meetingStore", () => {
  it("moves joined payloads into in-call state and tracks peer mode changes", () => {
    useMeetingStore.getState().beginJoin("room-1");
    useMeetingStore.getState().joined({
      is_host: true,
      mode: "p2p",
      peers: [
        {
          display_name: "Guest",
          id: "peer-2",
          is_host: false,
          mode: "p2p"
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
});
