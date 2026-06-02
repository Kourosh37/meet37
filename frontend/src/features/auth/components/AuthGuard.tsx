"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function AuthGuard({
  adminOnly = false,
  children
}: {
  adminOnly?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { hydrate, hydrated, isAdmin, isAuthenticated, status } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (status === "anonymous") {
      router.replace("/login");
      return;
    }

    if (adminOnly && isAuthenticated && !isAdmin) {
      router.replace("/");
    }
  }, [adminOnly, hydrated, isAdmin, isAuthenticated, router, status]);

  if (!hydrated || !isAuthenticated || (adminOnly && !isAdmin)) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
        Checking access...
      </div>
    );
  }

  return children;
}
