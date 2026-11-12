import { cookies } from "next/headers";
import { sendError, sendSuccess } from "@/utils/apiResponse";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { verifyAdminToken, verifyToken } from "@/utils/jwt";

// Tells the admin page how long the current access token has left, so it can renew the session in the
// background just before it ends (hooks/useSessionKeepAlive.ts). It never returns the token itself.
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;

  if (!token || !(await verifyAdminToken(token))) {
    return sendError(new UnauthorizedError("Access token missing or expired"));
  }

  const payload = await verifyToken(token);
  const expiresAt = payload?.exp ?? 0;
  return sendSuccess({ expiresInSeconds: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)) });
}
