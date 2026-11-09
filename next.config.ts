import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// The public MinIO address is a runtime env var (CHANGE-PLAN.md CP-8), so it has to be
// read here rather than hardcoded; img-src needs it for post/media thumbnails.
const s3Url = (() => {
  if (!process.env.S3_PUBLIC_URL) return undefined;
  try {
    return new URL(process.env.S3_PUBLIC_URL);
  } catch {
    return undefined;
  }
})();
const s3Origin = s3Url?.origin;

// next/image needs an explicit allowlist for remote hosts; media URLs are always under
// S3_PUBLIC_URL (see StorageService), so this is the only host real post images come from.
const s3RemotePattern = s3Url
  ? {
      protocol: s3Url.protocol.replace(":", "") as "http" | "https",
      hostname: s3Url.hostname,
      port: s3Url.port,
      pathname: "/**",
    }
  : undefined;

// script-src/style-src need 'unsafe-inline': the App Router streams RSC payloads through
// inline <script> tags, and framer-motion sets inline style attributes for animations.
// Neither is nonce-based today, so this is a baseline CSP, not a strict one.
const cspDirectives = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self'`,
  `img-src 'self' data:${s3Origin ? ` ${s3Origin}` : ""}`,
  `connect-src 'self'${isProd ? "" : " ws://localhost:* http://localhost:*"}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: s3RemotePattern ? [s3RemotePattern] : [],
    // Next 16 refuses to optimize an image whose host resolves to a private IP (SSRF guard).
    // Locally S3_PUBLIC_URL is MinIO on localhost, which always resolves that way; in production
    // it is a public domain, so this only ever relaxes the guard for the local dev network.
    dangerouslyAllowLocalIP: !isProd,
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
          { key: "Content-Security-Policy", value: cspDirectives },
        ],
      },
    ];
  },
};

export default nextConfig;
