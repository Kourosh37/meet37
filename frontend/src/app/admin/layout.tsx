import { Sidebar } from "@/components/layout/Sidebar";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { ThemeSwitch } from "@/components/layout/ThemeSwitch";
import { AuthGuard } from "@/features/auth/components/AuthGuard";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <Sidebar />
      <main
        className="relative mx-auto min-w-0 flex-1 border-x border-border px-4 py-6 sm:px-6 lg:px-8"
        id="main-content"
      >
        <div className="absolute end-4 top-4 flex items-center gap-2 sm:end-6 lg:end-8">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
        <AuthGuard adminOnly>{children}</AuthGuard>
      </main>
    </div>
  );
}
