import { NextResponse, type NextRequest } from "next/server";

const securityHeaders = {
  "Permissions-Policy":
    "camera=(self), microphone=(self), display-capture=(self)",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
