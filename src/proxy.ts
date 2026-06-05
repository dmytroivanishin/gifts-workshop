import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { UnauthorizedError } from "@/common/errors/unauthorized";

// Get secret key for JWT verification in Edge
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || "default_super_secret_key_change_me_in_prod";
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
      // Token is invalid or expired. We could redirect to a /refresh page, 
      // but usually the frontend handles refresh. To be safe, redirect to login.
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // 2. Protect Backend API Mutation Routes
  if (pathname.startsWith("/api/v1/")) {
    // Exclude auth routes from protection
    if (pathname.startsWith("/api/v1/auth/")) {
      return NextResponse.next();
    }

    const method = request.method;
    // Only protect mutating methods. GET requests remain public for the portfolio UI.
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
    const cookieName = isAdmin ? 'admin_locale' : 'NEXT_LOCALE';
    
    let locale = request.cookies.get(cookieName)?.value;

    if (!locale) {
      if (isAdmin) {
        locale = process.env.NEXT_PUBLIC_DEFAULT_ADMIN_LOCALE || 'ru';
      } else {
        const defaultLocale = process.env.NEXT_PUBLIC_DEFAULT_APP_LOCALE || 'ru';
        const acceptLanguage = request.headers.get('accept-language');
        
        if (!acceptLanguage) {
          locale = defaultLocale;
        } else {
          const preferred = acceptLanguage.split(',')[0].trim().toLowerCase();
          if (preferred.startsWith('ru') || preferred.startsWith('be') || preferred.startsWith('uk') || preferred.startsWith('kk')) {
            locale = 'ru';
          } else if (preferred.startsWith('en')) {
            locale = 'en';
          } else {
            locale = 'en'; 
          }
        }
      }
      
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-locale', locale);
      requestHeaders.set('x-is-admin', isAdmin ? 'true' : 'false');
      
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
    requestHeaders.set('x-is-admin', isAdmin ? 'true' : 'false');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|icons/|[^/]+\\.[\\w]+$).*)'],
};
