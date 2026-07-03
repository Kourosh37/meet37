import { fireEvent, render, screen } from "@testing-library/react";
import { VideoGrid } from "@/features/meeting/components/VideoGrid";
import type { MeetingPeer } from "@/features/meeting/types/peer";
import { describe, expect, it } from "vitest";

function peer(
  id: string,
  displayName: string,
  media: MeetingPeer["media"]
): MeetingPeer {
  return {
    connection: {
      mode: "sfu",
      quality: "unknown"
    },
    displayName,
    id,
    isHost: false,
    media
  };
}

const mediaOff: MeetingPeer["media"] = {
  audioEnabled: false,
  audioStatus: "off",
  screenSharing: false,
  screenShareStatus: "off",
  videoEnabled: false,
  videoStatus: "off"
};

describe("VideoGrid", () => {
  it("orders tiles by screen share, camera, microphone, then fully muted peers", () => {
    const { container } = render(
      <VideoGrid
        local={{
          audioEnabled: false,
          audioLevel: 0,
          audioStatus: "off",
          displayName: "Local Closed",
          isHost: true,
          mode: "p2p",
          screenSharing: false,
          screenShareStatus: "off",
          stream: null,
          videoEnabled: false,
          videoStatus: "off"
        }}
        peers={{
          closed: peer("closed", "Closed Peer", mediaOff),
          mic: peer("mic", "Mic Peer", {
            ...mediaOff,
            audioEnabled: true,
            audioStatus: "ready"
          }),
          video: peer("video", "Camera Peer", {
            ...mediaOff,
            videoEnabled: true,
            videoStatus: "ready"
          }),
          screen: peer("screen", "Screen Peer", {
            ...mediaOff,
            screenSharing: true,
            screenShareStatus: "ready",
            videoEnabled: true,
            videoStatus: "ready"
          })
        }}
        remoteStreams={{}}
      />
    );

    const labels = Array.from(container.querySelectorAll("article")).map(
      (tile) => tile.textContent ?? ""
    );

    expect(labels[0]).toContain("Screen Peer");
    expect(labels[1]).toContain("Camera Peer");
    expect(labels[2]).toContain("Mic Peer");
    expect(labels[3]).toContain("Local Closed");
    expect(labels[4]).toContain("Closed Peer");
  });

  it("uses a minimize control for the maximized tile", () => {
    render(
      <VideoGrid
        local={{
          audioEnabled: false,
          audioLevel: 0,
          audioStatus: "off",
          displayName: "Local Closed",
          isHost: true,
          mode: "p2p",
          screenSharing: false,
          screenShareStatus: "off",
          stream: null,
          videoEnabled: false,
          videoStatus: "off"
        }}
        peers={{}}
        remoteStreams={{}}
      />
    );

    fireEvent.click(screen.getByLabelText("Maximize Local Closed"));

    expect(screen.getByLabelText("Minimize video")).toBeTruthy();
  });
});
