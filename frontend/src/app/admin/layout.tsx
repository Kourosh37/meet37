import { Sidebar } from "@/components/layout/Sidebar";
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
        <div className="absolute right-4 top-4 sm:right-6 lg:right-8">
          <ThemeSwitch />
        </div>
        <AuthGuard adminOnly>{children}</AuthGuard>
      </main>
    </div>
  );
}
