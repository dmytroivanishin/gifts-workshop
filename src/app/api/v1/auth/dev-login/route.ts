import { NextResponse } from "next/server";
import { userRepository } from "@/repositories/drizzle/userRepository";
import { issueSession } from "@/utils/authSession";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import crypto from "crypto";
import { env } from "@/modules/core/env";

export async function POST() {
  try {
    // The flag is inlined at build time, so a mis-set production build would otherwise issue admin sessions
    if (env.NEXT_PUBLIC_DEV_MODE !== true || process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not allowed in production or without dev mode" }, { status: 403 });
    }

    const email = env.ADMIN_EMAILS[0];
    if (!email) {
      throw new Error("ADMIN_EMAILS is not defined or empty");
    }

    // Find or automatically create the admin user to obtain a valid UUID
    let user = await userRepository.getByEmail(email);
    if (!user) {
      user = await userRepository.save({
        id: crypto.randomUUID(),
        email,
        name: "Admin",
        password: "admin_hashed_password",
      });
    }
    const userId = user.id;

    await issueSession(userId, user.email);

    return sendSuccess({ success: true, email, id: userId });
  } catch (error: any) {
    return sendError(error);
  }
}
