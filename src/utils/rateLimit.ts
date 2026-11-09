import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

// Counters live in this process only, so this is correct for a single instance (one Coolify container).
// With several instances switch to a shared store (RateLimiterRedis) or use Traefik's rate-limit middleware.

export interface RateLimitRule {
  name: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export const RATE_LIMITS = {
  auth: { name: "auth", limit: 20, windowMs: 60 * 1000 },
  comment: { name: "comment", limit: 5, windowMs: 10 * 60 * 1000 },
  upload: { name: "upload", limit: 30, windowMs: 60 * 1000 },
  // Catch-all for authenticated writes not covered above (categories, posts, tags, …). Sized well
  // above anything a couple of admins working concurrently would hit, even sharing one address
  // behind the same NAT/proxy; it exists for a leaked/stolen token or a runaway script, not normal use.
  adminWrite: { name: "adminWrite", limit: 300, windowMs: 60 * 1000 },
  // Public reads (every GET under /api/v1 from a caller without a valid admin token). A page view
  // costs about 5-10 of these and the browser caches most of them for hours, so 120 per minute is far
  // above a real visitor while still stopping a scraper or a loop. Overridable for the test stack,
  // where one address runs the whole suite (RATE_LIMIT_PUBLIC_READ_PER_MINUTE, optional).
  publicRead: {
    name: "publicRead",
    limit: Number(process.env.RATE_LIMIT_PUBLIC_READ_PER_MINUTE) || 120,
    windowMs: 60 * 1000,
  },
} as const satisfies Record<string, RateLimitRule>;

export const PUBLIC_COMMENT_POST = /^\/api\/v1\/posts\/[a-zA-Z0-9_-]+\/comments$/;
const MEDIA_UPLOAD = /^\/api\/v1\/media\/?$/;
const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

// Which limit (if any) applies to a request. Only the routes that are public or expensive: login, the
// anonymous comment form, uploads, every authenticated write, and reads by anyone who is not an admin
// (an admin's own screens load many lists at once and are covered by the token check instead).
export function resolveRateLimitRule(method: string, pathname: string, isAdmin: boolean): RateLimitRule | undefined {
  if (!pathname.startsWith("/api/v1/")) return undefined;
  if (pathname.startsWith("/api/v1/auth/")) return RATE_LIMITS.auth;
  if (method === "POST" && PUBLIC_COMMENT_POST.test(pathname)) return RATE_LIMITS.comment;
  if (method === "POST" && MEDIA_UPLOAD.test(pathname)) return RATE_LIMITS.upload;
  // Every other authenticated write (categories, posts, tags, media edits/deletes, ...): see
  // RATE_LIMITS.adminWrite for why the limit is this loose.
  if (MUTATING_METHODS.includes(method)) return RATE_LIMITS.adminWrite;
  if ((method === "GET" || method === "HEAD") && !isAdmin) return RATE_LIMITS.publicRead;
  return undefined;
}

const limiters = new Map<string, RateLimiterMemory>();

function limiterFor(rule: RateLimitRule): RateLimiterMemory {
  let limiter = limiters.get(rule.name);
  if (!limiter) {
    limiter = new RateLimiterMemory({ keyPrefix: rule.name, points: rule.limit, duration: rule.windowMs / 1000 });
    limiters.set(rule.name, limiter);
  }
  return limiter;
}

export async function checkRateLimit(rule: RateLimitRule, clientKey: string): Promise<RateLimitResult> {
  try {
    await limiterFor(rule).consume(clientKey);
    return { allowed: true, retryAfterSeconds: 0 };
  } catch (rejection) {
    // The library rejects with RateLimiterRes when the limit is exceeded; anything else is a real error
    if (rejection instanceof RateLimiterRes) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(rejection.msBeforeNext / 1000)) };
    }
    throw rejection;
  }
}

// Assumes one trusted proxy (Traefik in Coolify) in front of the app: it appends the address it saw as the
// last X-Forwarded-For entry, while earlier entries are client-supplied and can be forged.
// If another proxy (for example Cloudflare) is added in front, every visitor would share one address here.
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").pop()?.trim();
    if (last) return last;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
