"use client";

import { useEffect, useRef } from "react";
import { Toaster, useSonner } from "sonner";
import { useTheme } from "next-themes";
import {
  installUiAudioUnlockListeners,
  playUiSound,
  type UiSoundKind
} from "@/lib/audio/uiSounds";

function soundForToastType(type?: string): UiSoundKind {
  if (type === "success") {
    return "success";
  }

  if (type === "error" || type === "warning") {
    return "error";
  }

  if (type === "loading") {
    return "action";
  }

  return "toast";
}

function ToastSoundEffects() {
  const { toasts } = useSonner();
  const knownToastSignatures = useRef<Map<string | number, string>>(new Map());

  useEffect(() => installUiAudioUnlockListeners(), []);

  useEffect(() => {
    toasts.forEach((toast) => {
      const signature = [
        toast.type,
        typeof toast.title === "string" ? toast.title : "",
        typeof toast.description === "string" ? toast.description : ""
      ].join(":");

      if (knownToastSignatures.current.get(toast.id) === signature) {
        return;
      }

      knownToastSignatures.current.set(toast.id, signature);
      playUiSound(soundForToastType(toast.type));
    });
  }, [toasts]);

  return null;
}

export function ToastProvider() {
  const { resolvedTheme } = useTheme();

  return (
    <>
      <ToastSoundEffects />
      <Toaster
        closeButton
        expand
        gap={-30}
        position="top-center"
        richColors={false}
        swipeDirections={["top"]}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        toastOptions={{
          classNames: {
            actionButton:
              "!h-7 !rounded-md !bg-primary !px-2.5 !py-1 !text-xs !text-primary-foreground",
            cancelButton:
              "!h-7 !rounded-md !bg-muted !px-2.5 !py-1 !text-xs !text-muted-foreground",
            closeButton:
              "!size-5 !border-border !bg-surface !text-muted-foreground hover:!text-foreground [&_svg]:!size-3",
            description: "!mt-0.5 !text-xs !leading-4 !text-muted-foreground",
            error:
              "!border-danger/35 !bg-danger/10 !text-surface-foreground [&_[data-icon]]:!text-danger",
            info: "!border-primary/30 !bg-primary/10 !text-surface-foreground [&_[data-icon]]:!text-primary",
            loading:
              "meet-toast-loading !border-primary/30 !bg-surface !text-surface-foreground [&_[data-icon]]:!text-primary",
            success:
              "!border-primary/35 !bg-primary/10 !text-surface-foreground [&_[data-icon]]:!text-primary",
            toast:
              "meet-toast !min-h-0 !rounded-md !border !border-border !bg-surface/95 !px-3 !py-2 !text-sm !leading-5 !text-surface-foreground !shadow-md !backdrop-blur-md [&_[data-icon]]:!size-4 [&_[data-title]]:!text-sm [&_[data-title]]:!leading-5",
            warning:
              "!border-amber-500/35 !bg-amber-500/10 !text-surface-foreground [&_[data-icon]]:!text-amber-500"
          },
          duration: 4200
        }}
      />
    </>
  );
}
