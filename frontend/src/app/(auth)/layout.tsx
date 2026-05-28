// Auth route group layout placeholder.
//
// Planned responsibilities:
// - Wrap login and admin routes with auth-aware shell behavior.
// - Redirect already-authenticated users away from login when appropriate.
// - Keep admin-only checks delegated to middleware or route-level guards.

import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
