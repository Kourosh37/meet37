import { create } from "zustand";

export interface MediaState {
  audioEnabled: boolean;
  error: string | null;
  screenSharing: boolean;
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  videoEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  setError: (error: string | null) => void;
  setScreenSharing: (enabled: boolean) => void;
  setSelectedAudioDeviceId: (deviceId: string) => void;
  setSelectedVideoDeviceId: (deviceId: string) => void;
  setVideoEnabled: (enabled: boolean) => void;
}

export const useMediaStore = create<MediaState>((set) => ({
  audioEnabled: true,
  error: null,
  screenSharing: false,
  selectedAudioDeviceId: "",
  selectedVideoDeviceId: "",
  videoEnabled: true,
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setError: (error) => set({ error }),
  setScreenSharing: (screenSharing) => set({ screenSharing }),
  setSelectedAudioDeviceId: (selectedAudioDeviceId) =>
    set({ selectedAudioDeviceId }),
  setSelectedVideoDeviceId: (selectedVideoDeviceId) =>
    set({ selectedVideoDeviceId }),
  setVideoEnabled: (videoEnabled) => set({ videoEnabled })
}));
