import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// The public MinIO address is a runtime env var (CHANGE-PLAN.md CP-8), so it has to be
// read here rather than hardcoded; img-src needs it for post/media thumbnails.
const s3Origin = (() => {
  if (!process.env.S3_PUBLIC_URL) return undefined;
  try {
    return new URL(process.env.S3_PUBLIC_URL).origin;
  } catch {
    return undefined;
  }
})();

// script-src/style-src need 'unsafe-inline': the App Router streams RSC payloads through
// inline <script> tags, and framer-motion sets inline style attributes for animations.
// Neither is nonce-based today, so this is a baseline CSP, not a strict one.
const cspDirectives = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `img-src 'self' data:${s3Origin ? ` ${s3Origin}` : ""}`,
  `connect-src 'self'${isProd ? "" : " ws://localhost:* http://localhost:*"}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: cspDirectives },
        ],
      },
    ];
  },
};

export default nextConfig;
