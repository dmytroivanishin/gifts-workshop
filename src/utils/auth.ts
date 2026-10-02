import { cookies } from "next/headers";
import { verifyAdminToken } from "./jwt";
import { userRepository } from "@/repositories/drizzle/userRepository";

export async function getUserId(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    if (!token) return undefined;

    const payload = await verifyAdminToken(token);
    if (!payload) return undefined;

    // Verify user exists
    const user = await userRepository.getById(payload.userId);
    if (!user) return undefined;

    return payload.userId;
  } catch (error) {
    return undefined;
  }
}

// Token claims only (no DB lookup): used to decide what a reader may see, not to authorize writes
export async function isAdminRequest(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    if (!token) return false;

    return (await verifyAdminToken(token)) !== null;
  } catch {
    return false;
  }
}
