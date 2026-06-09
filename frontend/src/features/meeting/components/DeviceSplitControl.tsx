"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const selectorButtonRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    bottom: number;
    left: number;
  } | null>(null);
  const isCompact = variant === "compact";
  const controlClassName = isCompact
    ? "h-11 min-w-11 max-[430px]:h-7"
    : "h-10 min-w-[6.75rem] px-3";
  const selectorClassName = isCompact
    ? "relative grid w-8 self-stretch place-items-center border-s border-border text-muted-foreground transition max-[430px]:order-first max-[430px]:h-4 max-[430px]:w-full max-[430px]:self-auto max-[430px]:border-b max-[430px]:border-s-0"
    : "relative grid w-8 self-stretch place-items-center border-s border-border text-muted-foreground transition";
  const canSelectDevice = !disabled;
  const deviceOptions = [
    {
      deviceId: "",
      label: defaultDeviceLabel
    },
    ...devices.map((device) => ({
      deviceId: device.deviceId,
      label: device.label || label
    }))
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function updatePosition() {
      const rect = selectorButtonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const menuWidth = 240;
      const viewportPadding = 8;
      setMenuPosition({
        bottom: Math.max(8, window.innerHeight - rect.top + 8),
        left: Math.min(
          window.innerWidth - menuWidth - viewportPadding,
          Math.max(viewportPadding, rect.left + rect.width / 2 - menuWidth / 2)
        )
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        selectorButtonRef.current?.contains(target)
      ) {
        return;
      }

      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (disabled) {
      setMenuOpen(false);
    }
  }, [disabled]);

  const deviceMenu =
    mounted && menuOpen && menuPosition
      ? createPortal(
          <div
            className="fixed z-[9999] w-60 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-2xl"
            onPointerDown={(event) => event.stopPropagation()}
            role="listbox"
            style={{
              bottom: menuPosition.bottom,
              left: menuPosition.left
            }}
          >
            {deviceOptions.map((device, index) => (
              <button
                aria-selected={selectedDeviceId === device.deviceId}
                className={cn(
                  "flex min-h-10 w-full items-center rounded-md px-3 text-start text-sm font-medium text-surface-foreground transition hover:bg-muted",
                  selectedDeviceId === device.deviceId && "bg-muted"
                )}
                key={`${device.deviceId || "default"}-${index}`}
                onClick={() => {
                  onSelectDevice(device.deviceId);
                  setMenuOpen(false);
                }}
                role="option"
                type="button"
              >
                <span className="truncate">{device.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        className={cn(
          "group inline-flex h-11 shrink-0 overflow-hidden rounded-md border border-border bg-background text-foreground transition max-[430px]:w-11 max-[430px]:flex-col",
          !disabled && "hover:bg-muted",
          disabled && "opacity-50",
          !isCompact &&
            "h-10 max-[430px]:h-10 max-[430px]:w-auto max-[430px]:flex-row",
          className
        )}
      >
        <button
          aria-label={toggleLabel}
          className={cn(
            "inline-flex items-center justify-center gap-2 transition group-hover:bg-muted disabled:cursor-not-allowed disabled:group-hover:bg-background",
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
        <div
          className={cn(
            selectorClassName,
            !disabled && "group-hover:bg-muted",
            disabled && "group-hover:bg-background"
          )}
        >
          <button
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            aria-label={selectLabel}
            className="grid h-full w-full place-items-center disabled:cursor-not-allowed"
            disabled={!canSelectDevice}
            onClick={() => setMenuOpen((open) => !open)}
            ref={selectorButtonRef}
            title={selectLabel}
            type="button"
          >
            <ChevronDown
              className="size-4 max-[430px]:size-3.5 max-[430px]:rotate-180"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
      {deviceMenu}
    </>
  );
}
