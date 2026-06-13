import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeviceSetup } from "@/features/prejoin/components/DeviceSetup";
import { useMediaStore } from "@/features/meeting/stores/mediaStore";
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

const mockDevices = [
  {
    deviceId: "audio-1",
    groupId: "group-1",
    kind: "audioinput",
    label: "Microphone 1",
    toJSON: () => ({})
  },
  {
    deviceId: "audio-2",
    groupId: "group-2",
    kind: "audioinput",
    label: "Microphone 2",
    toJSON: () => ({})
  },
  {
    deviceId: "video-1",
    groupId: "group-3",
    kind: "videoinput",
    label: "Camera 1",
    toJSON: () => ({})
  },
  {
    deviceId: "video-2",
    groupId: "group-4",
    kind: "videoinput",
    label: "Camera 2",
    toJSON: () => ({})
  }
] satisfies MediaDeviceInfo[];

describe("DeviceSetup", () => {
  beforeEach(() => {
    let assignedSrcObject: unknown = null;

    useMediaStore.setState({
      audioEnabled: true,
      error: null,
      screenSharing: false,
      selectedAudioDeviceId: "",
      selectedVideoDeviceId: "",
      videoEnabled: true
    });

    vi.stubGlobal(
      "MediaStream",
      class FakeMediaStream {
        private readonly tracks: FakeTrack[];

        constructor(tracks: FakeTrack[] = []) {
          this.tracks = tracks;
        }

        getAudioTracks() {
          return this.tracks.filter((track) => track.kind === "audio");
        }

        getTracks() {
          return this.tracks;
        }

        getVideoTracks() {
          return this.tracks.filter((track) => track.kind === "video");
        }
      }
    );

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
        enumerateDevices: vi.fn().mockResolvedValue(mockDevices),
        getUserMedia: vi.fn()
      }
    });
  });

  it("starts preview from the camera button without a separate test action", async () => {
    const stream = createFakeStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      stream as unknown as MediaStream
    );

    render(<DeviceSetup />);

    await waitFor(() => {
      const previewStream = document.querySelector("video")
        ?.srcObject as MediaStream;

      expect(previewStream?.getAudioTracks()).toContain(
        stream.tracks.audioTrack
      );
      expect(previewStream?.getVideoTracks()).toContain(
        stream.tracks.videoTrack
      );
    });

    expect(
      screen.queryByRole("button", { name: /test camera\/mic/i })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /turn camera off/i }));
    expect(screen.queryByText("Camera preview is off")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /turn camera on/i }));

    await waitFor(() => {
      const previewStream = document.querySelector("video")
        ?.srcObject as MediaStream;

      expect(previewStream?.getVideoTracks()).toContain(
        stream.tracks.videoTrack
      );
    });
  });

  it("restarts the active preview when selected devices change", async () => {
    const firstStream = createFakeStream();
    const secondStream = createFakeStream();
    const thirdStream = createFakeStream();
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockResolvedValueOnce(firstStream as unknown as MediaStream)
      .mockResolvedValueOnce(secondStream as unknown as MediaStream)
      .mockResolvedValueOnce(thirdStream as unknown as MediaStream);

    render(<DeviceSetup />);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Select microphone" }));
    fireEvent.click(screen.getByRole("option", { name: "Microphone 2" }));

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: expect.objectContaining({ deviceId: { exact: "audio-2" } }),
        video: false
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Select camera" }));
    fireEvent.click(screen.getByRole("option", { name: "Camera 2" }));

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: false,
        video: expect.objectContaining({ deviceId: { exact: "video-2" } })
      });
    });

    expect(firstStream.tracks.audioTrack.stop).toHaveBeenCalled();
    expect(firstStream.tracks.videoTrack.stop).toHaveBeenCalled();
  });
});
