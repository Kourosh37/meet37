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
