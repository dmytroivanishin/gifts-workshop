import { cookies } from "next/headers";
import { verifyToken } from "./jwt";

export async function getUserId(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    if (!token) return undefined;
    const payload = await verifyToken(token);
    return payload?.id as string | undefined;
  } catch (error) {
    return undefined;
  }
}
