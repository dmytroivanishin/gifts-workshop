import { NextResponse } from "next/server";
import { BaseError } from "@/common/errors/base";
import { InternalServerError } from "@/common/errors/internalServer";
import { logger } from "@/modules/logger";

export function sendSuccess(data: any, meta?: any) {
  const payload: any = { data };
  if (meta) {
    payload.meta = meta;
  }
  return NextResponse.json(payload);
}

export function sendError(error: any) {
  if (error instanceof BaseError) {
    logger.error(error.message, { code: error.errorCode, stack: error.stack });
    return NextResponse.json(
      {
        data: {},
        error: error.serialize(),
      },
      { status: error.statusCode }
    );
  }

  // Generic 500 error
  logger.error(error.message || "An unexpected error occurred", { 
    code: "INTERNAL_SERVER_ERROR", 
    stack: error.stack 
  });
  
  // The raw message stays in the log only: Drizzle errors carry the SQL text and bound parameters
  const internalError = new InternalServerError();
  return NextResponse.json(
    {
      data: {},
      error: internalError.serialize(),
    },
    { status: internalError.statusCode }
  );
}
