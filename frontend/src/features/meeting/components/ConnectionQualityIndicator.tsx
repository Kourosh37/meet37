"use client";

import type { ConnectionQuality } from "@/features/meeting/types/peer";
import { cn } from "@/lib/utils/cn";

interface ConnectionQualityIndicatorProps {
  isConnected: boolean;
  quality: ConnectionQuality;
}

const qualityConfig: Record<
  ConnectionQuality,
  { bars: number; label: string; shell: string; tone: string }
> = {
  good: {
    bars: 4,
    label: "Good connection",
    shell: "border-emerald-500/30 bg-emerald-500/10",
    tone: "bg-emerald-500"
  },
  poor: {
    bars: 1,
    label: "Poor connection",
    shell: "border-danger/35 bg-danger/10",
    tone: "bg-danger"
  },
  unknown: {
    bars: 2,
    label: "Connection quality pending",
    shell: "border-border bg-background",
    tone: "bg-muted-foreground"
  },
  warning: {
    bars: 3,
    label: "Unstable connection",
    shell: "border-amber-500/35 bg-amber-500/10",
    tone: "bg-amber-500"
  }
};

export function ConnectionQualityIndicator({
  isConnected,
  quality
}: ConnectionQualityIndicatorProps) {
  const config = isConnected
    ? qualityConfig[quality === "unknown" ? "good" : quality]
    : qualityConfig.poor;

  return (
    <div
      aria-label={isConnected ? config.label : "Disconnected"}
      className={cn(
        "flex h-10 items-end gap-0.5 rounded-md border px-2 pb-2 shadow-sm backdrop-blur",
        config.shell
      )}
      role="img"
      title={isConnected ? config.label : "Disconnected"}
    >
      {[1, 2, 3, 4].map((bar) => (
        <span
          className={cn(
            "w-1 rounded-full bg-muted transition-colors",
            bar <= config.bars && config.tone
          )}
          key={bar}
          style={{ height: `${bar * 4 + 4}px` }}
        />
      ))}
    </div>
  );
}
