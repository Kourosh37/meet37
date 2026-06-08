"use client";

import type { ConnectionQuality } from "@/features/meeting/types/peer";
import { cn } from "@/lib/utils/cn";

interface ConnectionQualityIndicatorProps {
  isConnected: boolean;
  pingMs?: number | null;
  quality: ConnectionQuality;
}

const qualityConfig: Record<
  ConnectionQuality,
  {
    bars: number;
    label: string;
    shell: string;
    text: string;
    tone: string;
  }
> = {
  good: {
    bars: 4,
    label: "Good connection",
    shell: "border-emerald-500/30 bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    tone: "bg-emerald-500"
  },
  poor: {
    bars: 1,
    label: "Poor connection",
    shell: "border-danger/35 bg-danger/10",
    text: "text-danger",
    tone: "bg-danger"
  },
  unknown: {
    bars: 2,
    label: "Connection quality pending",
    shell: "border-border bg-background",
    text: "text-muted-foreground",
    tone: "bg-muted-foreground"
  },
  warning: {
    bars: 3,
    label: "Unstable connection",
    shell: "border-amber-500/35 bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    tone: "bg-amber-500"
  }
};

function qualityFromPing(pingMs?: number | null): ConnectionQuality {
  if (pingMs === null || pingMs === undefined) {
    return "unknown";
  }

  if (pingMs <= 120) {
    return "good";
  }

  if (pingMs <= 250) {
    return "warning";
  }

  return "poor";
}

export function ConnectionQualityIndicator({
  isConnected,
  pingMs,
  quality
}: ConnectionQualityIndicatorProps) {
  const effectiveQuality = isConnected
    ? quality === "unknown"
      ? qualityFromPing(pingMs)
      : quality
    : "poor";
  const config = qualityConfig[effectiveQuality];
  const pingLabel =
    pingMs === null || pingMs === undefined ? "--" : String(pingMs);
  const title = isConnected
    ? `${config.label}${pingMs === null || pingMs === undefined ? "" : `, ${pingMs} ms`}`
    : "Disconnected";

  return (
    <div
      aria-label={title}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-2 shadow-sm backdrop-blur",
        config.shell,
        config.text
      )}
      role="img"
      title={title}
    >
      <span className="grid size-6 place-items-end rounded-full bg-background/70 px-1 pb-1 shadow-inner">
        <span className="flex h-4 items-end gap-0.5">
          {[1, 2, 3, 4].map((bar) => (
            <span
              className={cn(
                "w-0.5 rounded-full bg-muted transition-colors",
                bar <= config.bars && config.tone
              )}
              key={bar}
              style={{ height: `${bar * 3 + 2}px` }}
            />
          ))}
        </span>
      </span>
      <span className="inline-flex min-w-11 items-baseline leading-none">
        <span className="text-xs font-bold tabular-nums">{pingLabel}</span>
        <span className="ml-0.5 text-[8px] font-semibold uppercase tracking-wide opacity-75">
          ms
        </span>
      </span>
    </div>
  );
}
