import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdminToken } from "@/utils/jwt";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { TooManyRequestsError } from "@/common/errors/tooManyRequests";
import { RATE_LIMITS, checkRateLimit, getClientKey, type RateLimitRule } from "@/utils/rateLimit";

const PUBLIC_COMMENT_POST = /^\/api\/v1\/posts\/[a-zA-Z0-9_-]+\/comments$/;
const MEDIA_UPLOAD = /^\/api\/v1\/media\/?$/;

// Only the routes that are public or expensive: login, the anonymous comment form and uploads
const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function resolveRateLimitRule(method: string, pathname: string): RateLimitRule | undefined {
  if (pathname.startsWith("/api/v1/auth/")) return RATE_LIMITS.auth;
  if (method === "POST" && PUBLIC_COMMENT_POST.test(pathname)) return RATE_LIMITS.comment;
  if (method === "POST" && MEDIA_UPLOAD.test(pathname)) return RATE_LIMITS.upload;
  // Every other authenticated write (categories, posts, tags, media edits/deletes, …): see
  // RATE_LIMITS.adminWrite for why the limit is this loose.
  if (MUTATING_METHODS.includes(method) && pathname.startsWith("/api/v1/")) return RATE_LIMITS.adminWrite;
  return undefined;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Protect Admin UI Routes
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get("accessToken")?.value;

    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // 2. Protect Backend API Mutation Routes
  if (pathname.startsWith("/api/v1/")) {
    const rateLimitRule = resolveRateLimitRule(request.method, pathname);
    if (rateLimitRule) {
      const result = await checkRateLimit(rateLimitRule, getClientKey(request.headers));
      if (!result.allowed) {
        const error = new TooManyRequestsError();
        return NextResponse.json(
          { data: {}, error: error.serialize() },
          { status: error.statusCode, headers: { "Retry-After": String(result.retryAfterSeconds) } }
        );
      }
    }

    if (pathname.startsWith("/api/v1/auth/")) {
      return NextResponse.next();
    }

    const method = request.method;

    // Exception for public comments: allow POST /api/v1/posts/:id/comments
    if (method === "POST" && PUBLIC_COMMENT_POST.test(pathname)) {
      return NextResponse.next();
    }

    // These resources hold admin-only data, so even GET needs a token; every other GET stays public.
    // media is here too: the admin media library is its only consumer, and it must not leak files
    // belonging to unpublished posts the way GET /posts already hides them from anonymous readers.
    const isAdminOnlyResource = /^\/api\/v1\/(users|admin|media)(\/|$)/.test(pathname);

    if (isAdminOnlyResource || MUTATING_METHODS.includes(method)) {
      const token = request.cookies.get("accessToken")?.value;

      if (!token) {
        const error = new UnauthorizedError("Authentication required");
        return NextResponse.json(
          { data: {}, error: error.serialize() },
          { status: error.statusCode }
        );
      }

      if (!(await verifyAdminToken(token))) {
        const error = new UnauthorizedError("Invalid or expired token");
        return NextResponse.json(
          { data: {}, error: error.serialize() },
          { status: error.statusCode }
        );
      }
    }
  }

  // --- LOCALIZATION LOGIC ---
  if (
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.includes('.')
  ) {
    const isAdmin = pathname.startsWith('/admin');
    // NEXT_PUBLIC_DEFAULT_LOCALE (ru) is also the content/authoring fallback used elsewhere
    // (i18n's missing-translation fallback, the localization editor's "required" language,
    // getLocalizedField) — admin keeps using it as-is below. A visitor with no saved cookie and
    // no matching Accept-Language is a different concern, kept separate so changing one never
    // silently changes the other.
    const defaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'ru';
    const defaultPublicLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE_PUBLIC || 'en';
    const supportedLocales = (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES || 'ru,en').split(',').map(l => l.trim());

    if (isAdmin) {
      // Admin has no language switcher — it is Russian-only, always. Force defaultLocale
      // regardless of any leftover admin_locale cookie from before this was removed.
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-locale', defaultLocale);
      requestHeaders.set('x-is-admin', 'true');

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        }
      });
    } else {
      // Public area routing
      const pathnameHasLocale = supportedLocales.some(
        (loc) => pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`
      );
      
      let locale = defaultPublicLocale;
      if (pathnameHasLocale) {
         locale = pathname.split('/')[1];
      } else {
         const savedLocale = request.cookies.get('NEXT_LOCALE')?.value;
         if (savedLocale && supportedLocales.includes(savedLocale)) {
           locale = savedLocale;
         } else {
           const acceptLanguage = request.headers.get('accept-language');
           if (acceptLanguage) {
             const preferredLocales = acceptLanguage
               .split(',')
               .map(l => l.split(';')[0].trim().substring(0, 2).toLowerCase());
             
             const match = preferredLocales.find(l => supportedLocales.includes(l));
             if (match) {
               locale = match;
             }
           }
         }
      }

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-locale', locale);
      requestHeaders.set('x-is-admin', 'false');

      if (!pathnameHasLocale) {
        request.nextUrl.pathname = `/${locale}${pathname}`;
        const response = NextResponse.redirect(request.nextUrl);
        response.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: 31536000 });
        return response;
      }
      
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        }
      });
      response.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: 31536000 });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|icons/|[^/]+\\.[\\w]+$).*)'],
};
