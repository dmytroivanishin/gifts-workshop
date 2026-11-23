import { logger } from "@/modules/logger";
import { CLIENT_DISCONNECT_MESSAGE, clientDisconnectFields } from "@/utils/requestErrorLog";
import { isClientDisconnect } from "@/utils/uploadAbort";

const INSTALLED = Symbol.for("gifts-workshop.process-error-logging");

// Logs process-level errors and nothing else. The process must keep running: Next already keeps it
// alive after an uncaught error, and a client that disconnects mid-request raises one, so exiting
// here would turn an ordinary disconnect into an outage. A global flag stops a second install when
// the module is evaluated again (dev hot reload).
export function installProcessErrorLogging(): void {
  const holder = globalThis as unknown as Record<symbol, boolean | undefined>;
  if (holder[INSTALLED]) return;
  holder[INSTALLED] = true;

  process.on("uncaughtException", (error, origin) => {
    const message = error instanceof Error ? error.message : String(error);
    if (isClientDisconnect(error)) {
      logger.warn(CLIENT_DISCONNECT_MESSAGE, {
        code: "CLIENT_DISCONNECTED",
        ...clientDisconnectFields({ origin, errorMessage: message }),
      });
      return;
    }
    logger.error("Uncaught exception in the server process.", {
      code: "UNCAUGHT_EXCEPTION",
      origin,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
  });

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    logger.error("Unhandled promise rejection in the server process.", {
      code: "UNHANDLED_REJECTION",
      message,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
