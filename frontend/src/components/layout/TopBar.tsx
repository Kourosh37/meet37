"use client";

import { BrandMark } from "@/components/layout/BrandMark";
import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import { usePublicSettings } from "@/features/rooms/hooks/useRoomMeta";
import { LogIn, Plus } from "lucide-react";
import Link from "next/link";

export function TopBar() {
  const { data } = usePublicSettings();
  const showLogin = data?.app_mode === "private";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 border-x border-border px-4 sm:px-6">
        <Link
          className="inline-flex items-center gap-2 text-lg font-semibold tracking-normal text-foreground"
          href="/"
        >
          <BrandMark className="h-8 w-8" />
          meet37
        </Link>
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-2"
        >
          <ThemeSwitch />
          {showLogin ? (
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              href="/login"
            >
              <LogIn className="size-4" />
              Login
            </Link>
          ) : null}
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            href="/rooms/new"
          >
            <Plus className="size-4" />
            New room
          </Link>
        </nav>
      </div>
    </header>
  );
}
