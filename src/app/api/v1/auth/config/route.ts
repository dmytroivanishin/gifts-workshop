import { NextResponse } from "next/server";
import { sendSuccess, sendError } from "@/lib/apiResponse";

export async function GET() {
  try {
    return sendSuccess({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
    });
  } catch (error: any) {
    return sendError(error);
  }
}
