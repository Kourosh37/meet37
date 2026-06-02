import { TopBar } from "@/components/layout/TopBar";
import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main
        className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-6xl border-x border-border px-4 py-8 sm:px-6"
        id="main-content"
      >
        {children}
      </main>
    </div>
  );
}
