"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Link from "next/link";
import { useEffect } from "react";
import { InlineError } from "@/components/feedback/InlineError";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePublicSettings } from "@/features/rooms/hooks/useRoomMeta";
import { ApiClientError } from "@/lib/api/client";
import {
  roomCreationSchema,
  type RoomCreationFormValues
} from "@/lib/utils/validators";
import { useCreateRoom } from "@/features/rooms/hooks/useCreateRoom";

export function RoomCreationForm() {
  const router = useRouter();
  const createRoom = useCreateRoom();
  const { hydrate, hydrated, isAuthenticated } = useAuth();
  const settings = usePublicSettings();
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

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const privateModeRequiresLogin =
    settings.data?.app_mode === "private" && hydrated && !isAuthenticated;

  async function onSubmit(values: RoomCreationFormValues) {
    try {
      const latestSettings = await settings.refetch();
      if (latestSettings.data?.app_mode === "private" && !isAuthenticated) {
        toast.error("Login is required to create rooms in private mode");
        router.push("/login");
        return;
      }

      const response = await createRoom.mutateAsync({
        ...values,
        password: values.password || undefined,
        room_id: values.room_id || undefined
      });

      toast.success("Room created");
      router.push(`/meet/${response.room.id}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 403) {
        toast.error("Login is required to create rooms in private mode");
        router.push("/login");
        return;
      }

      toast.error(
        error instanceof Error ? error.message : "Could not create room"
      );
    }
  }

  if (privateModeRequiresLogin) {
    return (
      <div className="rounded-lg border border-border bg-background p-5">
        <h2 className="text-lg font-semibold text-foreground">
          Login required
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Room creation is private right now. Sign in with an admin-created
          account to create a meeting.
        </p>
        <Link
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          href="/login"
        >
          Login
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-surface-foreground"
          htmlFor="room-name"
        >
          Room name
        </label>
        <input
          className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          id="room-name"
          type="text"
          {...register("name")}
        />
        <InlineError message={errors.name?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-surface-foreground"
            htmlFor="join-policy"
          >
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
          <label
            className="text-sm font-medium text-surface-foreground"
            htmlFor="max-peers"
          >
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
          <InlineError message={errors.max_peers?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium text-surface-foreground"
          htmlFor="password"
        >
          Optional password
        </label>
        <input
          className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          id="password"
          type="password"
          {...register("password")}
        />
        <InlineError message={errors.password?.message} />
      </div>

      <input type="hidden" {...register("expires_in")} />

      <button
        className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={createRoom.isPending || settings.isLoading}
        type="submit"
      >
        {createRoom.isPending ? "Creating..." : "Create room"}
      </button>
    </form>
  );
}
