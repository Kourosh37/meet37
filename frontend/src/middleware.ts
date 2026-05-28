// Next.js middleware placeholder.
//
// Planned responsibilities:
// - Protect admin routes from unauthenticated users.
// - Redirect non-admin users away from /admin.
// - Add frontend security headers such as frame protection.
// - Avoid doing refresh-token rotation here unless cookie-based auth is introduced.

import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}
