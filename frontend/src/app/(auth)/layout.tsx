import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center border-x border-border px-4 py-10">
        <div className="absolute right-4 top-4 sm:right-6">
          <ThemeSwitch />
        </div>
        {children}
      </div>
    </main>
  );
}
