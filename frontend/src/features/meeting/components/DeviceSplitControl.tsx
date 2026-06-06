"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DeviceSplitControlProps {
  activeIcon: ReactNode;
  className?: string;
  defaultDeviceLabel: string;
  devices: MediaDeviceInfo[];
  disabled?: boolean;
  inactiveIcon: ReactNode;
  isEnabled: boolean;
  label: string;
  onSelectDevice: (deviceId: string) => void;
  onToggle: () => void;
  selectLabel: string;
  selectedDeviceId: string;
  title?: string;
  toggleLabel: string;
  variant?: "compact" | "labeled";
}

export function DeviceSplitControl({
  activeIcon,
  className,
  defaultDeviceLabel,
  devices,
  disabled = false,
  inactiveIcon,
  isEnabled,
  label,
  onSelectDevice,
  onToggle,
  selectLabel,
  selectedDeviceId,
  title,
  toggleLabel,
  variant = "compact"
}: DeviceSplitControlProps) {
  const isCompact = variant === "compact";
  const controlClassName = isCompact
    ? "h-11 min-w-11"
    : "h-10 min-w-[6.75rem] px-3";

  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-md border border-border bg-background text-foreground",
        disabled && "opacity-50",
        className
      )}
    >
      <button
        aria-label={toggleLabel}
        className={cn(
          "inline-flex items-center justify-center gap-2 transition hover:bg-muted disabled:cursor-not-allowed disabled:hover:bg-background",
          controlClassName
        )}
        disabled={disabled}
        onClick={onToggle}
        title={title ?? toggleLabel}
        type="button"
      >
        {isEnabled ? activeIcon : inactiveIcon}
        {isCompact ? null : (
          <span className="text-sm font-medium">{label}</span>
        )}
      </button>
      <div className="relative grid h-11 w-8 place-items-center border-l border-border text-muted-foreground">
        <select
          aria-label={selectLabel}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          disabled={disabled || devices.length === 0}
          onChange={(event) => onSelectDevice(event.target.value)}
          title={selectLabel}
          value={selectedDeviceId}
        >
          <option value="">{defaultDeviceLabel}</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || label}
            </option>
          ))}
        </select>
        <ChevronDown className="size-4" aria-hidden="true" />
      </div>
    </div>
  );
}
