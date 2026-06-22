import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { UnauthorizedError } from "@/common/errors/unauthorized";

// Get secret key for JWT verification in Edge
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables.");
  }
  return new TextEncoder().encode(secret);
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. Protect Admin UI Routes
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get("accessToken")?.value;
    
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    try {
      await jwtVerify(token, getJwtSecret());
    } catch (error) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // 2. Protect Backend API Mutation Routes
  if (pathname.startsWith("/api/v1/")) {
    if (pathname.startsWith("/api/v1/auth/")) {
      return NextResponse.next();
    }

    const method = request.method;
    
    // Exception for public comments: allow POST /api/v1/posts/:id/comments
    if (method === "POST" && pathname.match(/^\/api\/v1\/posts\/[a-zA-Z0-9_-]+\/comments$/)) {
      return NextResponse.next();
    }

    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      const token = request.cookies.get("accessToken")?.value;

      if (!token) {
        const error = new UnauthorizedError("Authentication required");
        return NextResponse.json(
          { data: {}, error: error.serialize() },
          { status: error.statusCode }
        );
      }

      try {
        await jwtVerify(token, getJwtSecret());
      } catch (err) {
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
    const defaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'ru';
    const supportedLocales = (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES || 'ru,en').split(',').map(l => l.trim());

    if (isAdmin) {
      // Admin area locale handling
      const cookieName = 'admin_locale';
      let locale = request.cookies.get(cookieName)?.value;
      
      if (!locale || !supportedLocales.includes(locale)) {
        locale = defaultLocale;
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-locale', locale);
        requestHeaders.set('x-is-admin', 'true');
        
        const response = NextResponse.next({
          request: {
            headers: requestHeaders,
          }
        });
        response.cookies.set(cookieName, locale, { path: '/', maxAge: 31536000 });
        return response;
      }

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-locale', locale);
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
      
      let locale = defaultLocale;
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
