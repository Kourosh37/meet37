"use client";

import { useLocale } from "@/providers/LocaleProvider";
import { cn } from "@/lib/utils/cn";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Globe2 } from "lucide-react";
import type { CSSProperties } from "react";

interface LanguageSwitchProps {
  className?: string;
}

export function LanguageSwitch({ className }: LanguageSwitchProps) {
  const { currentLocale, setLocale, supportedLocales, t } = useLocale();
  const label = t("common.switchLanguage", {
    language: currentLocale.nativeName
  });

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={label}
          className={cn(
            "meet-language-trigger inline-flex size-10 items-center justify-center gap-1 rounded-md border border-border bg-surface text-surface-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-muted hover:shadow-md",
            className
          )}
          title={label}
          type="button"
        >
          <Globe2 className="size-4" />
          <span className="text-[9px] font-black uppercase leading-none tracking-normal">
            {currentLocale.label}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="meet-language-menu z-[9999] grid max-h-[min(28rem,calc(100vh-5rem))] w-[min(calc(100vw-1rem),24rem)] gap-1 overflow-y-auto rounded-lg border border-border bg-surface p-1.5 text-surface-foreground shadow-2xl"
          sideOffset={8}
        >
          {supportedLocales.map((locale, index) => {
            const selected = locale.code === currentLocale.code;

            return (
              <DropdownMenu.Item
                className={cn(
                  "meet-language-item grid min-h-11 cursor-pointer select-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition hover:bg-muted focus:bg-muted",
                  selected && "bg-primary/10 text-primary"
                )}
                key={locale.code}
                onSelect={() => setLocale(locale.code)}
                style={
                  {
                    "--meet-language-index": index,
                    direction: "ltr"
                  } as CSSProperties
                }
              >
                <span
                  className={cn(
                    "block w-full min-w-0 truncate text-xs font-bold leading-none",
                    locale.direction === "rtl" ? "text-right" : "text-left"
                  )}
                  dir={locale.direction}
                  style={{ justifySelf: "stretch" }}
                >
                  {locale.nativeName}
                </span>
                <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-1 text-[10px] font-black uppercase leading-none tracking-normal text-muted-foreground">
                  {locale.label}
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
