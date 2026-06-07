"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function ToastProvider() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      closeButton
      expand
      position="top-center"
      richColors={false}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      toastOptions={{
        classNames: {
          actionButton:
            "!rounded-md !bg-primary !px-3 !py-1.5 !text-primary-foreground",
          cancelButton:
            "!rounded-md !bg-muted !px-3 !py-1.5 !text-muted-foreground",
          closeButton:
            "!border-border !bg-surface !text-muted-foreground hover:!text-foreground",
          description: "!text-muted-foreground",
          error:
            "!border-danger/35 !bg-danger/10 !text-surface-foreground [&_[data-icon]]:!text-danger",
          info: "!border-primary/30 !bg-primary/10 !text-surface-foreground [&_[data-icon]]:!text-primary",
          loading:
            "!border-primary/30 !bg-surface !text-surface-foreground [&_[data-icon]]:!text-primary",
          success:
            "!border-primary/35 !bg-primary/10 !text-surface-foreground [&_[data-icon]]:!text-primary",
          toast:
            "!rounded-lg !border !border-border !bg-surface/95 !text-surface-foreground !shadow-lg !backdrop-blur-md",
          warning:
            "!border-amber-500/35 !bg-amber-500/10 !text-surface-foreground [&_[data-icon]]:!text-amber-500"
        },
        duration: 4200
      }}
    />
  );
}
