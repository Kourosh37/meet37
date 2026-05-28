/*
Frontend architecture note

File: src\features\rooms\components\RoomCreationForm.tsx
Layer: Rooms

Responsibility:
- Room creation form for name, optional password, join policy open/approval, max peers, and expiry; it must persist the returned host_token for the creator session.

Implementation contract:
- Keep this file narrowly scoped; do not mix unrelated feature state, route rendering, and infrastructure concerns.
- Prefer feature-local components/hooks/stores first, then shared lib utilities only when behavior is reused across features.
- Match the existing backend contract exactly; if backend/docs/API.md or backend/docs/WEBSOCKET.md changes, update this file's types and assumptions in the same change.

Backend contract: POST /api/rooms, GET /api/rooms, GET /api/rooms/{id}, DELETE /api/rooms/{id}, GET /api/rooms/{id}/chat, and GET /api/rooms/{id}/files. Public/private app mode changes whether creation requires auth; joining a shared room link remains public.

State model to plan: loading room list, creating, created with host_token, private-mode auth required, invalid room, expired room, password required, and create failure.

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

Future tests: public room creation without token, private mode creation with token, host_token persistence, room metadata rendering, password-room path, and API error mapping.

*/

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/api/client";
import { roomCreationSchema, type RoomCreationFormValues } from "@/lib/utils/validators";
import { useCreateRoom } from "@/features/rooms/hooks/useCreateRoom";

export function RoomCreationForm() {
  const router = useRouter();
  const createRoom = useCreateRoom();
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<RoomCreationFormValues>({
    defaultValues: {
      expires_in: 0,
      join_policy: "open",
      max_peers: 50
    },
    resolver: zodResolver(roomCreationSchema)
  });

  async function onSubmit(values: RoomCreationFormValues) {
    try {
      const response = await createRoom.mutateAsync({
        ...values,
        password: values.password || undefined
      });

      toast.success("Room created");
      router.push(`/meet/${response.room.id}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 403) {
        toast.error("Login is required to create rooms in private mode");
        router.push("/login");
        return;
      }

      toast.error(error instanceof Error ? error.message : "Could not create room");
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-surface-foreground" htmlFor="room-name">
          Room name
        </label>
        <input
          className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          id="room-name"
          type="text"
          {...register("name")}
        />
        {errors.name ? <p className="text-sm text-danger">{errors.name.message}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-surface-foreground" htmlFor="join-policy">
            Join policy
          </label>
          <select
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            id="join-policy"
            {...register("join_policy")}
          >
            <option value="open">Open</option>
            <option value="approval">Host approval</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-surface-foreground" htmlFor="max-peers">
            Maximum peers
          </label>
          <input
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            id="max-peers"
            min={2}
            max={500}
            type="number"
            {...register("max_peers")}
          />
          {errors.max_peers ? (
            <p className="text-sm text-danger">{errors.max_peers.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-surface-foreground" htmlFor="password">
          Optional password
        </label>
        <input
          className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          id="password"
          type="password"
          {...register("password")}
        />
        {errors.password ? <p className="text-sm text-danger">{errors.password.message}</p> : null}
      </div>

      <input type="hidden" {...register("expires_in")} />

      <button
        className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={createRoom.isPending}
        type="submit"
      >
        {createRoom.isPending ? "Creating..." : "Create room"}
      </button>
    </form>
  );
}
