async function installMediaMocks(page) {
  await page.addInitScript(() => {
    class MockMediaStreamTrack extends EventTarget {
      enabled = true;
      id = crypto.randomUUID();
      muted = false;
      readyState = "live";

      constructor(kind) {
        super();
        this.kind = kind;
        this.label = `Mock ${kind}`;
      }

      getSettings() {
        return {};
      }

      stop() {
        this.readyState = "ended";
      }
    }

    class MockMediaStream {
      constructor(tracks = []) {
        this.tracks = tracks;
      }

      getTracks() {
        return this.tracks;
      }

      getAudioTracks() {
        return this.tracks.filter((track) => track.kind === "audio");
      }

      getVideoTracks() {
        return this.tracks.filter((track) => track.kind === "video");
      }
    }

    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: async () => [
          { deviceId: "audio-1", kind: "audioinput", label: "Mock microphone" },
          { deviceId: "video-1", kind: "videoinput", label: "Mock camera" }
        ],
        getUserMedia: async () =>
          new MockMediaStream([
            new MockMediaStreamTrack("audio"),
            new MockMediaStreamTrack("video")
          ])
      }
    });
  });
}

module.exports = { installMediaMocks };
