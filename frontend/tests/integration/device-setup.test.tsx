import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { DeviceSetup } from "@/features/prejoin/components/DeviceSetup";
import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeTrack = {
  enabled: boolean;
  kind: MediaStreamTrack["kind"];
  readyState: MediaStreamTrackState;
  stop: ReturnType<typeof vi.fn>;
};

function createFakeStream() {
  const videoTrack: FakeTrack = {
    enabled: true,
    kind: "video",
    readyState: "live",
    stop: vi.fn()
  };
  const audioTrack: FakeTrack = {
    enabled: true,
    kind: "audio",
    readyState: "live",
    stop: vi.fn()
  };

  return {
    getAudioTracks: () => [audioTrack],
    getTracks: () => [audioTrack, videoTrack],
    getVideoTracks: () => [videoTrack],
    tracks: {
      audioTrack,
      videoTrack
    }
  };
}

describe("DeviceSetup", () => {
  beforeEach(() => {
    let assignedSrcObject: unknown = null;

    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      get() {
        return assignedSrcObject;
      },
      set(value) {
        assignedSrcObject = value;
      }
    });

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn()
      }
    });
  });

  it("reattaches the existing camera stream when prejoin camera is toggled back on", async () => {
    const stream = createFakeStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      stream as unknown as MediaStream
    );

    render(<DeviceSetup />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /test camera\/mic/i })
      );
    });

    await waitFor(() => {
      expect(document.querySelector("video")?.srcObject).toBe(stream);
    });

    fireEvent.click(screen.getByRole("button", { name: /^camera$/i }));
    expect(screen.queryByText("Camera preview is off")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^camera$/i }));

    await waitFor(() => {
      expect(document.querySelector("video")?.srcObject).toBe(stream);
    });
    expect(stream.tracks.videoTrack.enabled).toBe(true);
  });
});
