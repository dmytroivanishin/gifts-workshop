import { requireAdmin } from "@/utils/auth";
import { sendError } from "@/utils/apiResponse";

// Route-level auth gate: a second, independent check on top of proxy.ts, so a bypass of the
// proxy does not leave writes open. Lives at the route.ts layer (not in controllers) so
// controllers stay focused on business logic, same as Express middleware vs. handler.
export function withAdminAuth<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>
): (request: Request, ...args: Args) => Promise<Response> {
  return async (request: Request, ...args: Args) => {
    try {
      await requireAdmin();
    } catch (error) {
      return sendError(error);
    }
    return handler(request, ...args);
  };
}
