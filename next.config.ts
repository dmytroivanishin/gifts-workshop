import { MAX_UPLOAD_BODY_BYTES } from "./src/utils/uploadLimits";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next cuts request bodies above this size before the route runs; the limit is the upload size plus multipart framing.
  experimental: {
    proxyClientMaxBodySize: MAX_UPLOAD_BODY_BYTES,
  },
  // Self-contained server (`.next/standalone/server.js`) for the Docker image: only the traced
  // runtime dependencies are copied, not the whole node_modules.
  output: "standalone",
  images: {
    // Uploads are already resized and re-encoded at upload time (StorageService), so next/image
    // serves the stored files as they are instead of running its own optimizer on every request.
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
