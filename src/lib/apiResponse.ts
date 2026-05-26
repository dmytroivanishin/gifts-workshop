import { NextResponse } from "next/server";
import { BaseError } from "@/common/errors/base";

export function sendSuccess(data: any, meta?: any) {
  const payload: any = { data };
  if (meta) {
    payload.meta = meta;
  }
  return NextResponse.json(payload);
}

export function sendError(error: any) {
  if (error instanceof BaseError) {
    return NextResponse.json(
      {
        data: {},
        error: error.serialize(),
      },
      { status: error.statusCode }
    );
  }

  // Generic 500 error
  return NextResponse.json(
    {
      data: {},
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error.message || "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
}
