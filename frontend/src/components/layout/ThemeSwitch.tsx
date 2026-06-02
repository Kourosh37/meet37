"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface ThemeSwitchProps {
  className?: string;
}

export function ThemeSwitch({ className }: ThemeSwitchProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = `Switch theme to ${nextTheme}`;

  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-md border border-border bg-surface text-surface-foreground transition hover:bg-muted",
        className
      )}
      onClick={() => setTheme(nextTheme)}
      title={label}
      type="button"
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
