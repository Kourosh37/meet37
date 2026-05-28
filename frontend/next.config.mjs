// Next.js configuration placeholder.
//
// Planned responsibilities:
// - Enable strict production checks.
// - Configure image domains if avatars or room thumbnails use remote sources.
// - Add security headers for frame protection and content policy.
// - Optionally enable standalone output for Docker production images.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  outputFileTracingRoot: projectRoot,
  output: "standalone",
  reactStrictMode: true
};

export default nextConfig;
