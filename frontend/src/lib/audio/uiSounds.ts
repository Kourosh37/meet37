"use client";

export type UiSoundKind =
  | "action"
  | "callEnd"
  | "chat"
  | "error"
  | "reaction"
  | "success"
  | "toast";

export type UiSoundSettings = {
  actions: boolean;
  chat: boolean;
  enabled: boolean;
  notifications: boolean;
  reactions: boolean;
};

type SoundSegment = {
  durationMs: number;
  url: string;
  volume: number;
};

const SOUND_SEGMENTS: Record<UiSoundKind, SoundSegment> = {
  action: { durationMs: 100, url: "/sounds/ui/action-soft.wav", volume: 0.46 },
  callEnd: { durationMs: 340, url: "/sounds/ui/call-end.wav", volume: 0.5 },
  chat: { durationMs: 300, url: "/sounds/ui/chat-note.wav", volume: 0.56 },
  error: { durationMs: 161, url: "/sounds/ui/error-caution.wav", volume: 0.58 },
  reaction: {
    durationMs: 240,
    url: "/sounds/ui/reaction-pop.wav",
    volume: 0.5
  },
  success: {
    durationMs: 300,
    url: "/sounds/ui/success-note.wav",
    volume: 0.55
  },
  toast: { durationMs: 180, url: "/sounds/ui/toast-ping.wav", volume: 0.48 }
};

export const defaultUiSoundSettings: UiSoundSettings = {
  actions: true,
  chat: true,
  enabled: true,
  notifications: true,
  reactions: true
};

const SOUND_SETTINGS_STORAGE_KEY = "meet37-ui-sound-settings";
type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
type ActiveSound = {
  gain: GainNode;
  isStopped: boolean;
  source: AudioBufferSourceNode;
};

const audioBufferCache = new Map<string, Promise<AudioBuffer>>();
const activeSounds = new Set<ActiveSound>();
let soundSettings = defaultUiSoundSettings;
let hasInteracted = false;
let lastPlayedAt = new Map<UiSoundKind, number>();
let lastGlobalPlayedAt = 0;
let pendingSound: UiSoundKind | null = null;
let activeStopTimer: number | null = null;
let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  if (audioContext) {
    return audioContext;
  }

  const AudioContextCtor =
    window.AudioContext ?? (window as AudioWindow).webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  audioContext = new AudioContextCtor();

  return audioContext;
}

async function resumeAudioContext(ctx: AudioContext) {
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

function loadAudioBuffer(url: string) {
  const ctx = getAudioContext();

  if (!ctx) {
    return null;
  }

  const cached = audioBufferCache.get(url);

  if (cached) {
    return cached;
  }

  const bufferPromise = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load UI sound: ${url}`);
      }

      return response.arrayBuffer();
    })
    .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer.slice(0)));

  audioBufferCache.set(url, bufferPromise);

  return bufferPromise;
}

function stopSound(sound: ActiveSound) {
  if (sound.isStopped) {
    return;
  }

  sound.isStopped = true;

  try {
    sound.source.stop();
  } catch {
    // The source may have already ended.
  }

  try {
    sound.source.disconnect();
    sound.gain.disconnect();
  } catch {
    // Disconnection is best-effort after the node has ended.
  }

  activeSounds.delete(sound);
}

function stopActiveSounds() {
  if (activeStopTimer) {
    window.clearTimeout(activeStopTimer);
    activeStopTimer = null;
  }

  activeSounds.forEach((sound) => stopSound(sound));
}

function readStoredSettings(): UiSoundSettings {
  if (typeof window === "undefined") {
    return defaultUiSoundSettings;
  }

  try {
    const stored = window.localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY);

    if (!stored) {
      return defaultUiSoundSettings;
    }

    return {
      ...defaultUiSoundSettings,
      ...(JSON.parse(stored) as Partial<UiSoundSettings>)
    };
  } catch {
    return defaultUiSoundSettings;
  }
}

function categoryEnabled(kind: UiSoundKind) {
  if (!soundSettings.enabled) {
    return false;
  }

  if (kind === "chat") {
    return soundSettings.chat;
  }

  if (kind === "reaction") {
    return soundSettings.reactions;
  }

  if (kind === "action") {
    return soundSettings.actions;
  }

  return soundSettings.notifications;
}

async function unlockAudioAssets() {
  hasInteracted = true;

  const urls = new Set(
    Object.values(SOUND_SEGMENTS)
      .map((segment) => segment.url)
  );
  const ctx = getAudioContext();

  if (!ctx) {
    return;
  }

  await Promise.allSettled(
    [resumeAudioContext(ctx), ...[...urls].map((url) => loadAudioBuffer(url))]
  );

  if (pendingSound) {
    const sound = pendingSound;
    pendingSound = null;
    window.setTimeout(() => playUiSound(sound), 40);
  }
}

async function playSegment(segment: SoundSegment) {
  const ctx = getAudioContext();
  const bufferPromise = loadAudioBuffer(segment.url);

  if (!ctx || !bufferPromise) {
    return;
  }

  const buffer = await bufferPromise;
  await resumeAudioContext(ctx);

  stopActiveSounds();

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const sound: ActiveSound = { gain, isStopped: false, source };
  const startAt = ctx.currentTime + 0.02;

  source.buffer = buffer;
  gain.gain.setValueAtTime(segment.volume, startAt);
  source.connect(gain);
  gain.connect(ctx.destination);
  activeSounds.add(sound);
  source.addEventListener("ended", () => {
    stopSound(sound);
  });
  source.start(startAt);
  activeStopTimer = window.setTimeout(() => {
    activeStopTimer = null;
    stopSound(sound);
  }, segment.durationMs + 120);
}

export function preloadUiSounds() {
  soundSettings = readStoredSettings();

  if (hasInteracted) {
    void unlockAudioAssets();
  }
}

export function playUiSound(kind: UiSoundKind) {
  if (typeof window === "undefined") {
    return;
  }

  soundSettings = readStoredSettings();

  if (!categoryEnabled(kind)) {
    return;
  }

  const now = performance.now();
  const lastKindPlayedAt = lastPlayedAt.get(kind) ?? 0;

  if (now - lastGlobalPlayedAt < 80 || now - lastKindPlayedAt < 180) {
    return;
  }

  if (!hasInteracted) {
    pendingSound = kind;
    return;
  }

  lastGlobalPlayedAt = now;
  lastPlayedAt.set(kind, now);
  void playSegment(SOUND_SEGMENTS[kind]);
}

export function getUiSoundSettings() {
  soundSettings = readStoredSettings();
  return soundSettings;
}

export function setUiSoundSettings(settings: UiSoundSettings) {
  soundSettings = settings;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        SOUND_SETTINGS_STORAGE_KEY,
        JSON.stringify(settings)
      );
    } catch {
      // Keep the in-memory setting if persistent storage is unavailable.
    }
  }
}

export function previewUiSound(kind: UiSoundKind) {
  hasInteracted = true;
  lastGlobalPlayedAt = 0;
  lastPlayedAt = new Map();
  void playSegment(SOUND_SEGMENTS[kind]);
}

export function installUiAudioUnlockListeners() {
  if (typeof window === "undefined") {
    return () => {};
  }

  preloadUiSounds();

  const unlock = () => {
    void unlockAudioAssets();
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}
