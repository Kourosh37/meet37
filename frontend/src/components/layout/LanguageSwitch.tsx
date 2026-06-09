"use client";

import { useLocale } from "@/providers/LocaleProvider";
import { cn } from "@/lib/utils/cn";
import * as FlagIcons from "country-flag-icons/react/3x2";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Globe2 } from "lucide-react";
import type { ComponentType, CSSProperties, SVGProps } from "react";

interface LanguageSwitchProps {
  className?: string;
}

const flagIcons = FlagIcons as Record<
  string,
  ComponentType<SVGProps<SVGSVGElement>>
>;

function CountryFlag({ code }: { code: string }) {
  const Flag = flagIcons[code];

  if (!Flag) {
    return (
      <span className="grid h-4 min-w-6 place-items-center rounded-sm border border-border bg-muted px-1 text-[9px] font-black leading-none text-muted-foreground">
        {code}
      </span>
    );
  }

  return (
    <Flag
      aria-hidden="true"
      className="h-4 w-6 shrink-0 rounded-[2px] object-cover shadow-sm ring-1 ring-black/10"
      focusable="false"
    />
  );
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
                  "meet-language-item grid min-h-12 cursor-pointer select-none gap-1.5 rounded-md px-2.5 py-2 text-sm outline-none transition hover:bg-muted focus:bg-muted",
                  selected && "bg-primary/10 text-primary"
                )}
                dir={locale.direction}
                key={locale.code}
                onSelect={() => setLocale(locale.code)}
                style={
                  {
                    "--meet-language-index": index
                  } as CSSProperties
                }
              >
                <span className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs font-bold leading-none">
                    {locale.nativeName}
                  </span>
                  <span className="shrink-0 text-[11px] font-black uppercase leading-none tracking-normal">
                    {locale.label}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="flex flex-wrap gap-1"
                >
                  {locale.flagCountries.map((countryCode, flagIndex) => (
                    <CountryFlag
                      code={countryCode}
                      key={`${locale.code}-${countryCode}-${flagIndex}`}
                    />
                  ))}
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
