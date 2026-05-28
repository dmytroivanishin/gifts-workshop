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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/v1/:path*"
  ],
};
