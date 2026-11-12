import crypto from "crypto";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { tokenRepository } from "@/repositories/drizzle/tokenRepository";
import { userRepository } from "@/repositories/drizzle/userRepository";
import { issueSession } from "@/utils/authSession";
import { isAllowedAdminEmail } from "@/utils/jwt";

// Shared by every provider: the email must be on the admin allowlist, then the user row is found or created and a session is issued
export async function completeAdminLogin(email: string): Promise<void> {
  if (!isAllowedAdminEmail(email)) {
    throw new UnauthorizedError("Unauthorized email address");
  }

  let user = await userRepository.getByEmail(email);
  if (!user) {
    user = await userRepository.save({
      id: crypto.randomUUID(),
      email,
      name: "Admin",
      password: "admin_hashed_password",
    });
  }

  await issueSession(user.id, user.email);
  // Opportunistic cleanup of long-expired sessions (see tokenRepository.deleteExpired)
  await tokenRepository.deleteExpired();
}
