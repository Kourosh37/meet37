"use client";

import { BrandMark } from "@/components/layout/BrandMark";
import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import { ConnectionQualityIndicator } from "@/features/meeting/components/ConnectionQualityIndicator";
import type { ConnectionQuality } from "@/features/meeting/types/peer";
import { cn } from "@/lib/utils/cn";

interface MeetingHeaderProps {
  connectionQuality?: ConnectionQuality;
  isConnected?: boolean;
  participantCount?: number;
  pingMs?: number | null;
  roomName?: string;
  statusLabel?: string;
}

function statusBadgeClass(isConnected: boolean) {
  return isConnected
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function pingBadgeClass(pingMs?: number | null) {
  if (pingMs === null || pingMs === undefined) {
    return "border-border bg-background text-muted-foreground";
  }

  if (pingMs <= 120) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (pingMs <= 250) {
    return "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  return "border-danger/35 bg-danger/10 text-danger";
}

export function MeetingHeader({
  connectionQuality,
  isConnected = false,
  participantCount,
  pingMs,
  roomName = "Meeting room",
  statusLabel
}: MeetingHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 mx-auto flex h-16 w-full max-w-7xl items-center gap-3 overflow-hidden border-x border-b border-border bg-surface px-3 shadow-md shadow-slate-950/10 backdrop-blur sm:px-6">
      <BrandMark className="h-10 w-10 shrink-0" size={40} />

      <h1 className="flex h-10 min-w-0 flex-1 items-center truncate text-base font-semibold tracking-normal text-surface-foreground sm:text-lg">
        {roomName}
      </h1>

      {statusLabel ? (
        <span
          className={cn(
            "hidden h-10 shrink-0 items-center rounded-md border px-2.5 text-xs font-semibold uppercase tracking-wide sm:inline-flex",
            statusBadgeClass(isConnected)
          )}
        >
          {statusLabel}
        </span>
      ) : null}

      {connectionQuality ? (
        <ConnectionQualityIndicator
          isConnected={isConnected}
          quality={connectionQuality}
        />
      ) : null}

      {isConnected ? (
        <span
          className={cn(
            "inline-flex h-10 shrink-0 items-center rounded-md border px-2.5 text-xs font-semibold",
            pingBadgeClass(pingMs)
          )}
        >
          {pingMs === null || pingMs === undefined ? "--" : pingMs} ms
        </span>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        {participantCount !== undefined ? (
          <span className="hidden whitespace-nowrap sm:inline">
            {participantCount} participants
          </span>
        ) : null}
        <ThemeSwitch className="bg-background" />
      </div>
    </header>
  );
}
