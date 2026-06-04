"use client";

import { BrandMark } from "@/components/layout/BrandMark";
import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import { ConnectionQualityIndicator } from "@/features/meeting/components/ConnectionQualityIndicator";
import type { ConnectionQuality } from "@/features/meeting/types/peer";

interface MeetingHeaderProps {
  connectionQuality?: ConnectionQuality;
  isConnected?: boolean;
  participantCount?: number;
  roomName?: string;
  statusLabel?: string;
}

export function MeetingHeader({
  connectionQuality,
  isConnected = false,
  participantCount,
  roomName = "Meeting room",
  statusLabel
}: MeetingHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 mx-auto flex h-16 w-full max-w-7xl items-center gap-3 overflow-hidden border-x border-b border-border bg-surface px-3 shadow-md shadow-slate-950/10 backdrop-blur sm:px-6">
      <BrandMark className="h-8 w-8 shrink-0" size={32} />

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-normal text-surface-foreground sm:text-lg">
        {roomName}
      </h1>

      {statusLabel ? (
        <span className="hidden shrink-0 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:inline-flex">
          {statusLabel}
        </span>
      ) : null}

      {connectionQuality ? (
        <ConnectionQualityIndicator
          isConnected={isConnected}
          quality={connectionQuality}
        />
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
