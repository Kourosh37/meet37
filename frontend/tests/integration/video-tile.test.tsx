import { render, screen } from "@testing-library/react";
import { VideoTile } from "@/features/meeting/components/VideoTile";
import { describe, expect, it } from "vitest";

describe("VideoTile", () => {
  it("shows camera loading inside the peer tile while the video track is missing", () => {
    render(
      <VideoTile
        displayName="Nina"
        stream={null}
        videoEnabled
        videoStatus="starting"
      />
    );

    expect(screen.getByText("Opening camera")).toBeTruthy();
  });

  it("shows screen-share loading inside the peer tile while the shared track is missing", () => {
    render(
      <VideoTile
        displayName="Nina"
        screenSharing
        screenShareStatus="starting"
        stream={null}
      />
    );

    expect(screen.getByText("Opening shared screen")).toBeTruthy();
  });

  it("falls back to the avatar when camera is intentionally off", () => {
    render(
      <VideoTile
        displayName="Nina Parker"
        stream={null}
        videoEnabled={false}
        videoStatus="off"
      />
    );

    expect(screen.queryByText("Opening camera")).toBeNull();
    expect(screen.getByText("NP")).toBeTruthy();
  });

  it("shows microphone loading while the local audio track is being opened", () => {
    render(
      <VideoTile
        audioEnabled
        audioStatus="starting"
        displayName="Nina"
        stream={null}
        videoEnabled={false}
      />
    );

    expect(screen.getByLabelText("Opening microphone")).toBeTruthy();
  });
});
