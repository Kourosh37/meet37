/*
Frontend architecture note

File: src\features\prejoin\components\DeviceSetup.tsx
Layer: Pre-Join

Responsibility:
- Frontend file for the Pre-Join layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: room metadata comes from GET /api/rooms/{id}; actual admission happens through WebSocket join, with password and approval handling based on room policy.

State model to plan: loading, ready, empty, recoverable error, fatal error, and cleanup/unmount behavior where applicable.

UX and edge cases to plan:
- Display clear loading and empty states instead of rendering nothing once implementation starts.
- Normalize backend errors into user-safe messages while preserving technical details for logger.ts.
- Keep room links shareable; never require global login just to open an existing meeting link.
- In private app mode, require login only for room creation, not for joining a shared room link.
- Every meeting participant must provide a non-empty display name before joining.

Security and privacy notes:
- Never expose refresh tokens to arbitrary components; use the storage/auth layer only.
- Treat host_token as room-scoped moderation authority and avoid leaking it into URLs or logs.
- Do not persist raw media streams, SDP blobs, ICE candidates, or file bytes unless a later backend feature explicitly requires it.

Future tests: success path, loading path, error path, accessibility expectations, and cleanup/side-effect boundaries.

*/

"use client";

import { Camera, CameraOff, Mic, MicOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { useDeviceSetup } from "@/features/prejoin/hooks/useDeviceSetup";

export function DeviceSetup() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const setup = useDeviceSetup();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = setup.previewStream;
    }
  }, [setup.previewStream]);

  return (
    <div className="space-y-4">
      <div className="aspect-video overflow-hidden rounded-lg border border-border bg-slate-950">
        {setup.previewStream && setup.videoEnabled ? (
          <video
            autoPlay
            className="h-full w-full scale-x-[-1] object-cover"
            muted
            playsInline
            ref={videoRef}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-slate-300">
            <div>
              <CameraOff className="mx-auto size-10" />
              <p className="mt-3 text-sm">Camera preview is off</p>
            </div>
          </div>
        )}
      </div>

      {setup.error ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {setup.error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-surface-foreground transition hover:bg-muted"
          onClick={() => setup.setAudioEnabled(!setup.audioEnabled)}
          type="button"
        >
          {setup.audioEnabled ? (
            <Mic className="size-4" />
          ) : (
            <MicOff className="size-4" />
          )}
          Mic
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-surface-foreground transition hover:bg-muted"
          onClick={() => setup.setVideoEnabled(!setup.videoEnabled)}
          type="button"
        >
          {setup.videoEnabled ? (
            <Camera className="size-4" />
          ) : (
            <CameraOff className="size-4" />
          )}
          Camera
        </button>
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          disabled={setup.permissionState === "prompting"}
          onClick={setup.startPreview}
          type="button"
        >
          {setup.permissionState === "prompting"
            ? "Checking..."
            : "Test camera/mic"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          onChange={(event) =>
            setup.setSelectedAudioDeviceId(event.target.value)
          }
          value={setup.selectedAudioDeviceId}
        >
          <option value="">Default microphone</option>
          {setup.audioInputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || "Microphone"}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          onChange={(event) =>
            setup.setSelectedVideoDeviceId(event.target.value)
          }
          value={setup.selectedVideoDeviceId}
        >
          <option value="">Default camera</option>
          {setup.videoInputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || "Camera"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
