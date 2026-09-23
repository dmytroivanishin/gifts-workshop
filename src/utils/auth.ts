import { cookies } from "next/headers";
import { verifyToken } from "./jwt";
import { userRepository } from "@/repositories/drizzle/userRepository";

export async function getUserId(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    if (!token) return undefined;
    
    const payload = await verifyToken(token);
    const userId = payload?.userId as string | undefined;
    
    if (!userId) return undefined;
    
    // Verify user exists
    const user = await userRepository.getById(userId);
    if (!user) return undefined;
    
    return userId;
  } catch (error) {
    return undefined;
  }
}

// Signature check only (no DB lookup): used to decide what a reader may see, not to authorize writes
export async function isAdminRequest(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    if (!token) return false;

    const payload = await verifyToken(token);
    return payload?.role === "admin";
  } catch {
    return false;
  }
}
