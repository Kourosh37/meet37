"use client";

import type { ConnectionQuality } from "@/features/meeting/types/peer";
import { cn } from "@/lib/utils/cn";

interface ConnectionQualityIndicatorProps {
  isConnected: boolean;
  quality: ConnectionQuality;
}

const qualityConfig: Record<
  ConnectionQuality,
  { bars: number; label: string; tone: string }
> = {
  good: {
    bars: 4,
    label: "Good connection",
    tone: "bg-emerald-500"
  },
  poor: {
    bars: 1,
    label: "Poor connection",
    tone: "bg-danger"
  },
  unknown: {
    bars: 2,
    label: "Connection quality pending",
    tone: "bg-muted-foreground"
  },
  warning: {
    bars: 3,
    label: "Unstable connection",
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
      className="flex items-end gap-0.5 rounded-md border border-border bg-background/80 px-2 py-1.5 text-muted-foreground shadow-sm backdrop-blur"
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
