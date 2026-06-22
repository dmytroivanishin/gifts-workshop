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
