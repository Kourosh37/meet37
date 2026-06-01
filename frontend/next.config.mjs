// Next.js configuration placeholder.
//
// Planned responsibilities:
// - Enable strict production checks.
// - Configure image domains if avatars or room thumbnails use remote sources.
// - Add security headers for frame protection and content policy.
// - Optionally enable standalone output for Docker production images.

import { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const backendInternalUrl = (
  process.env.BACKEND_INTERNAL_URL || "http://localhost:8080"
).replace(/\/$/, "");

const nextConfig = {
  outputFileTracingRoot: projectRoot,
  output: "standalone",
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendInternalUrl}/api/:path*`
      },
      {
        source: "/ws",
        destination: `${backendInternalUrl}/ws`
      }
    ];
  }
};

export default nextConfig;
