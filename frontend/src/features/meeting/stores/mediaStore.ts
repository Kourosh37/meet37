import { create } from "zustand";

export interface MediaState {
  audioEnabled: boolean;
  error: string | null;
  preparedStream: MediaStream | null;
  screenSharing: boolean;
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  videoEnabled: boolean;
  consumePreparedStream: () => MediaStream | null;
  setAudioEnabled: (enabled: boolean) => void;
  setError: (error: string | null) => void;
  setPreparedStream: (stream: MediaStream | null) => void;
  setScreenSharing: (enabled: boolean) => void;
  setSelectedAudioDeviceId: (deviceId: string) => void;
  setSelectedVideoDeviceId: (deviceId: string) => void;
  setVideoEnabled: (enabled: boolean) => void;
}

export const useMediaStore = create<MediaState>((set) => ({
  audioEnabled: true,
  error: null,
  preparedStream: null,
  screenSharing: false,
  selectedAudioDeviceId: "",
  selectedVideoDeviceId: "",
  videoEnabled: true,
  consumePreparedStream: () => {
    let preparedStream: MediaStream | null = null;
    set((state) => {
      preparedStream = state.preparedStream;
      return { preparedStream: null };
    });
    return preparedStream;
  },
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setError: (error) => set({ error }),
  setPreparedStream: (preparedStream) => set({ preparedStream }),
  setScreenSharing: (screenSharing) => set({ screenSharing }),
  setSelectedAudioDeviceId: (selectedAudioDeviceId) =>
    set({ selectedAudioDeviceId }),
  setSelectedVideoDeviceId: (selectedVideoDeviceId) =>
    set({ selectedVideoDeviceId }),
  setVideoEnabled: (videoEnabled) => set({ videoEnabled })
}));
