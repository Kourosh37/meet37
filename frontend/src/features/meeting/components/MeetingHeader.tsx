"use client";

import { BrandMark } from "@/components/layout/BrandMark";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import { ConnectionQualityIndicator } from "@/features/meeting/components/ConnectionQualityIndicator";
import type { ConnectionQuality } from "@/features/meeting/types/peer";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/providers/LocaleProvider";

interface MeetingHeaderProps {
  connectionQuality?: ConnectionQuality;
  isConnected?: boolean;
  participantCount?: number;
  pingMs?: number | null;
  roomId?: string;
  roomName?: string;
  statusLabel?: string;
}

export function MeetingHeader({
  connectionQuality,
  isConnected = false,
  participantCount,
  pingMs,
  roomId,
  roomName,
  statusLabel
}: MeetingHeaderProps) {
  const { t } = useLocale();

  async function copyRoomId() {
    if (!roomId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(roomId);
      toast.success(t("meeting.copyRoomIdSuccess"));
    } catch {
      toast.error(t("meeting.copyRoomIdFailed"));
    }
  }

  const displayedRoomName = roomName ?? t("meeting.defaultRoomName");

  return (
    <header className="fixed inset-x-0 top-0 z-30 mx-auto flex h-16 w-full max-w-7xl items-center gap-3 overflow-hidden border-x border-b border-border bg-surface px-3 shadow-md shadow-slate-950/10 backdrop-blur sm:px-6">
      <BrandMark className="h-10 w-10 shrink-0" size={40} />

      <div className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:h-10 sm:flex-row sm:items-center sm:gap-2">
        <h1 className="min-w-0 truncate text-base font-semibold tracking-normal text-surface-foreground sm:text-lg">
          {displayedRoomName}
        </h1>
        {roomId ? (
          <>
            <button
              className="inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded border border-border bg-background px-1.5 text-[11px] font-semibold leading-none text-muted-foreground transition hover:bg-muted sm:hidden"
              onClick={copyRoomId}
              title={t("meeting.copyRoomId")}
              type="button"
            >
              <span className="truncate">{roomId}</span>
              <Copy className="size-3" />
            </button>
            <button
              className="hidden h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted sm:inline-flex"
              onClick={copyRoomId}
              title={t("meeting.copyRoomId")}
              type="button"
            >
              {roomId}
              <Copy className="size-3.5" />
            </button>
          </>
        ) : null}
      </div>

      {connectionQuality || isConnected || statusLabel ? (
        <ConnectionQualityIndicator
          isConnected={isConnected}
          pingMs={pingMs}
          quality={connectionQuality ?? "unknown"}
          statusLabel={statusLabel}
        />
      ) : null}

      <div className="ms-auto flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        {participantCount !== undefined ? (
          <span className="hidden whitespace-nowrap sm:inline">
            {t("meeting.participants", { count: participantCount })}
          </span>
        ) : null}
        <LanguageSwitch className="bg-background" />
        <ThemeSwitch className="bg-background" />
      </div>
    </header>
  );
}
