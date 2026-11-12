import { NextResponse, type NextRequest } from "next/server";
import { POST as refreshSession } from "../refresh/route";

const DEFAULT_ADMIN_PAGE = "/admin/dashboard";

// Only admin pages are valid return targets: the param comes from the URL, so anything else (an external
// host, a protocol-relative "//" address) falls back to the dashboard.
function safeAdminTarget(raw: string | null): string {
  if (!raw || !raw.startsWith("/admin") || raw.startsWith("//")) return DEFAULT_ADMIN_PAGE;
  return raw;
}

// The refresh cookie is only sent to /api/v1/auth, so the page guard in proxy.ts cannot read it. When the
// access token has expired, the guard sends the browser here: the session is rotated in the background
// and the browser is returned to the page it asked for, without showing the login form. If there is no
// valid refresh session, the rotation fails and the browser goes to the login page instead.
export async function GET(request: NextRequest) {
  const target = safeAdminTarget(request.nextUrl.searchParams.get("to"));
  const refreshed = await refreshSession();

  if (!refreshed.ok) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return NextResponse.redirect(new URL(target, request.url));
}
