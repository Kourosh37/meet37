import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center border-x border-border px-4 py-10">
        <div className="absolute end-4 top-4 flex items-center gap-2 sm:end-6">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
        {children}
      </div>
    </main>
  );
}
