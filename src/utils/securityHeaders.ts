import type { NextResponse } from "next/server";

// Built per request, not at build time: S3_PUBLIC_URL is a runtime setting, so changing it only needs a
// container restart. next.config.ts cannot do this, its headers are fixed into the build output.
export function buildContentSecurityPolicy(): string {
  const isProd = process.env.NODE_ENV === "production";

  let s3Origin: string | undefined;
  if (process.env.S3_PUBLIC_URL) {
    try {
      s3Origin = new URL(process.env.S3_PUBLIC_URL).origin;
    } catch {
      s3Origin = undefined;
    }
  }

  // script-src/style-src need 'unsafe-inline': the App Router streams RSC payloads through inline
  // <script> tags, and framer-motion sets inline style attributes. Neither is nonce-based, so this is a
  // baseline CSP, not a strict one.
  return [
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
}

export function applyContentSecurityPolicy(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy());
  return response;
}
