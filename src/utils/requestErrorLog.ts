import { isClientDisconnect } from "@/utils/uploadAbort";

// Turns an error Next caught in a request into one log entry. A client that closed the connection
// is a normal event, so it is a warning without a stack. Everything else is an error with its stack.
// Only the path is logged, without the query string (a search term can be in it), and never headers:
// they carry the admin cookie.

export interface RequestErrorInput {
  path: string;
  method: string;
}

export interface RequestErrorContext {
  routerKind: string;
  routePath: string;
  routeType: string;
}

// One field set for every CLIENT_DISCONNECTED record, whether it came from a request (Next's
// onRequestError) or from the process (uncaughtException). A field that does not exist in one of
// those places is left undefined, so a search on a field name finds the same record shape everywhere.
export const CLIENT_DISCONNECT_MESSAGE = "The client closed the connection before the request finished.";

export interface ClientDisconnectFields {
  method?: string;
  path?: string;
  routePath?: string;
  routeType?: string;
  routerKind?: string;
  digest?: string;
  origin?: string;
  errorMessage?: string;
}

export function clientDisconnectFields(fields: ClientDisconnectFields): Required<ClientDisconnectFields> {
  return {
    method: fields.method as string,
    path: fields.path as string,
    routePath: fields.routePath as string,
    routeType: fields.routeType as string,
    routerKind: fields.routerKind as string,
    digest: fields.digest as string,
    origin: fields.origin as string,
    errorMessage: fields.errorMessage as string,
  };
}

export interface RequestErrorLogEntry {
  level: "warn" | "error";
  code: "CLIENT_DISCONNECTED" | "REQUEST_FAILED";
  message: string;
  fields: Record<string, unknown>;
}

export function describeRequestError(
  error: unknown,
  request: RequestErrorInput,
  context: RequestErrorContext
): RequestErrorLogEntry {
  const path = request.path.split("?")[0];
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const requestFields = {
    method: request.method,
    path,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    digest,
  };

  if (isClientDisconnect(error)) {
    return {
      level: "warn",
      code: "CLIENT_DISCONNECTED",
      message: CLIENT_DISCONNECT_MESSAGE,
      fields: clientDisconnectFields({ ...requestFields, errorMessage: message }),
    };
  }

  return {
    level: "error",
    code: "REQUEST_FAILED",
    message,
    fields: { ...requestFields, stack: error instanceof Error ? error.stack : undefined },
  };
}
