"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Link from "next/link";
import { useEffect } from "react";
import { InlineError } from "@/components/feedback/InlineError";
import { LoadingSpinner } from "@/components/feedback/LoadingSpinner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePublicSettings } from "@/features/rooms/hooks/useRoomMeta";
import { ApiClientError } from "@/lib/api/client";
import {
  roomCreationSchema,
  type RoomCreationFormValues
} from "@/lib/utils/validators";
import { useCreateRoom } from "@/features/rooms/hooks/useCreateRoom";
import { useLocale } from "@/providers/LocaleProvider";
import { Home } from "lucide-react";

export function RoomCreationForm() {
  const router = useRouter();
  const createRoom = useCreateRoom();
  const { hydrate, hydrated, isAuthenticated } = useAuth();
  const { t } = useLocale();
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
        toast.error(t("error.loginRequiredPrivateMode"));
        router.push("/login");
        return;
      }

      const response = await createRoom.mutateAsync({
        ...values,
        password: values.password || undefined,
        room_id: values.room_id || undefined
      });

      toast.success(t("room.roomCreated"));
      router.push(`/meet/${response.room.id}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 403) {
        toast.error(t("error.loginRequiredPrivateMode"));
        router.push("/login");
        return;
      }

      toast.error(t("error.couldNotCreateRoom"));
    }
  }

  if (privateModeRequiresLogin) {
    return (
      <div className="rounded-lg border border-border bg-background p-5">
        <h2 className="text-lg font-semibold text-foreground">
          {t("room.loginRequired")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("room.loginRequiredBody")}
        </p>
        <Link
          className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          href="/login"
        >
          {t("auth.login")}
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
          {t("room.roomName")}
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
            {t("room.joinPolicy")}
          </label>
          <select
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            id="join-policy"
            {...register("join_policy")}
          >
            <option value="open">{t("common.open")}</option>
            <option value="approval">{t("meeting.hostApproval")}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-surface-foreground"
            htmlFor="max-peers"
          >
            {t("room.maximumPeers")}
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
          {t("room.optionalPassword")}
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

      <div className="grid gap-2">
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={createRoom.isPending || settings.isLoading}
          type="submit"
        >
          {createRoom.isPending || settings.isLoading ? (
            <LoadingSpinner label={t("room.creatingRoom")} size="sm" />
          ) : null}
          {createRoom.isPending ? t("common.creating") : t("room.createRoom")}
        </button>
        <Link
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
          href="/"
        >
          <Home className="size-4" />
          {t("common.backHome")}
        </Link>
      </div>
    </form>
  );
}
