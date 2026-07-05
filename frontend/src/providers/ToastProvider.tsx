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
  );
}
