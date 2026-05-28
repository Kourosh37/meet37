/*
Frontend architecture note

File: src\app\meet\[roomId]\page.tsx
Layer: Meeting Runtime

Responsibility:
- Frontend file for the Meeting Runtime layer. It should implement only the responsibility implied by its route/feature name and should stay aligned with docs/ARCHITECTURE.md.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: WebSocket signaling endpoint described in backend/docs/WEBSOCKET.md plus room metadata from GET /api/rooms/{id}. The join payload must include display_name and may include password and host_token.

State model to plan: idle, prejoining, waiting-approval, joining, in-call, reconnecting, sfu-active, kicked, rejected, room-closed, media-error, and left.

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

Future tests: WebSocket join flow, approval room flow, host approve/reject, kick/mute messages, P2P signaling, SFU switch handling, chat/file events, and cleanup on leave.

*/

import { Video } from "lucide-react";
import Link from "next/link";

type PrejoinPageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

export default async function PrejoinPage({ params }: PrejoinPageProps) {
  const { roomId } = await params;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="aspect-video rounded-lg border border-border bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex h-full items-center justify-center rounded-md border border-white/10 bg-white/5">
            <div className="text-center">
              <Video className="mx-auto size-10 text-primary" />
              <p className="mt-3 text-sm text-slate-300">Camera preview will appear here.</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Room {roomId}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-surface-foreground">
            Join the meeting
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Phase 6 will load room metadata, collect your display name, and check optional room
            password requirements before joining.
          </p>
          <div className="mt-6 grid gap-4">
            <div className="h-11 rounded-md border border-border bg-background" aria-hidden="true" />
            <button
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground opacity-60"
              disabled
              type="button"
            >
              Join now
            </button>
          </div>
          <Link
            className="mt-4 inline-flex text-sm font-medium text-muted-foreground hover:text-foreground"
            href="/"
          >
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}
