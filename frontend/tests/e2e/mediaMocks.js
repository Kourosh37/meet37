/* global MediaStream, module, window */
async function installMediaMocks(page) {
  await page.addInitScript(() => {
    function createMockMediaStream() {
      const tracks = [];
      const canvas = window.document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext("2d");

      if (context) {
        context.fillStyle = "#0f766e";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#ffffff";
        context.font = "32px sans-serif";
        context.fillText("Mock camera", 32, 64);
      }

      if (typeof canvas.captureStream === "function") {
        tracks.push(...canvas.captureStream(5).getVideoTracks());
      }

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (AudioContextClass) {
        const audioContext = new AudioContextClass();
        const destination = audioContext.createMediaStreamDestination();
        tracks.push(...destination.stream.getAudioTracks());
      }

      return new MediaStream(tracks);
    }

    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: async () => [
          { deviceId: "audio-1", kind: "audioinput", label: "Mock microphone" },
          { deviceId: "video-1", kind: "videoinput", label: "Mock camera" }
        ],
        getUserMedia: async () => createMockMediaStream()
      }
    });
  });
}

module.exports = { installMediaMocks };
