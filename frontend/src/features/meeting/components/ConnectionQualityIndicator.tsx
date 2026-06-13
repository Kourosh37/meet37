"use client";

import type { ConnectionQuality } from "@/features/meeting/types/peer";
import { cn } from "@/lib/utils/cn";
import { useLocale } from "@/providers/LocaleProvider";
import { Wifi, WifiOff } from "lucide-react";

interface ConnectionQualityIndicatorProps {
  isConnected: boolean;
  pingMs?: number | null;
  quality: ConnectionQuality;
  statusLabel?: string;
}

const qualityConfig: Record<
  ConnectionQuality,
  {
    shell: string;
    text: string;
  }
> = {
  good: {
    shell:
      "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-700/70 dark:bg-emerald-950/80 dark:text-emerald-200",
    text: "text-emerald-700 dark:text-emerald-200"
  },
  poor: {
    shell:
      "border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-700/70 dark:bg-rose-950/80 dark:text-rose-200",
    text: "text-rose-700 dark:text-rose-200"
  },
  unknown: {
    shell:
      "border-slate-300/80 bg-slate-50 text-slate-700 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-slate-200",
    text: "text-slate-600 dark:text-slate-200"
  },
  warning: {
    shell:
      "border-amber-300/80 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/80 dark:text-amber-200",
    text: "text-amber-700 dark:text-amber-200"
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
  quality,
  statusLabel
}: ConnectionQualityIndicatorProps) {
  const { t } = useLocale();
  const normalizedStatus = statusLabel?.toLowerCase() ?? "";
  const isRecovering =
    !isConnected &&
    Boolean(statusLabel) &&
    normalizedStatus !== "closed" &&
    statusLabel !== t("common.disconnected");
  const effectiveQuality: ConnectionQuality = isConnected
    ? quality === "unknown"
      ? qualityFromPing(pingMs)
      : quality
    : isRecovering
      ? "warning"
      : normalizedStatus.includes("ready")
        ? "unknown"
        : "poor";
  const config = qualityConfig[effectiveQuality];
  const qualityLabel =
    effectiveQuality === "good"
      ? t("connection.good")
      : effectiveQuality === "warning"
        ? t("connection.unstable")
        : effectiveQuality === "poor"
          ? t("connection.poor")
          : t("connection.pending");
  const pingLabel =
    pingMs === null || pingMs === undefined ? "--" : String(pingMs);
  const title = `${statusLabel ?? (isConnected ? qualityLabel : t("common.disconnected"))}${pingMs === null || pingMs === undefined ? "" : `, ${pingMs} ms`}`;
  const Icon = isConnected || isRecovering ? Wifi : WifiOff;

  return (
    <div
      aria-label={title}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-1.5 shadow-sm backdrop-blur",
        config.shell
      )}
      role="img"
      title={title}
    >
      <span className="grid size-5 place-items-center rounded-full bg-white/75 shadow-inner dark:bg-slate-950/55">
        <Icon className={cn("size-3.5", config.text)} strokeWidth={2.4} />
      </span>
      {statusLabel ? (
        <span className="hidden max-w-20 truncate text-[10px] font-bold leading-none tracking-normal sm:inline">
          {statusLabel}
        </span>
      ) : null}
      <span className="h-3.5 w-px bg-current/20" />
      <span
        className="inline-flex min-w-9 items-baseline justify-end leading-none"
        dir="ltr"
      >
        <span className="text-[11px] font-bold tabular-nums">{pingLabel}</span>
        <span className="ml-0.5 text-[7px] font-bold uppercase tracking-normal opacity-70">
          ms
        </span>
      </span>
    </div>
  );
}
