import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/auth", () => ({
  requireAdmin: vi.fn(),
}));

import { withAdminAuth } from "@/utils/withAdminAuth";
import { requireAdmin } from "@/utils/auth";
import { getContentVersion } from "@/utils/contentVersion";
import { UnauthorizedError } from "@/common/errors/unauthorized";

const okResponse = () => new Response(JSON.stringify({ data: {} }), { status: 200 });

describe("withAdminAuth", () => {
  beforeEach(() => {
    vi.mocked(requireAdmin).mockReset();
  });

  it("answers 401 and never calls the handler when there is no valid admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new UnauthorizedError());
    const handler = vi.fn();

    const response = await withAdminAuth(handler)(new Request("http://x/api/v1/users"));

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the handler for an admin and passes the route arguments through", async () => {
    vi.mocked(requireAdmin).mockResolvedValue("user-id");
    const handler = vi.fn(async (_request: Request, context: { id: string }) => {
      expect(context.id).toBe("42");
      return okResponse();
    });

    const response = await withAdminAuth(handler)(new Request("http://x/api/v1/users/42"), { id: "42" });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("raises the public content version after a successful write, but not after a read or a failed write", async () => {
    vi.mocked(requireAdmin).mockResolvedValue("user-id");

    const beforeRead = getContentVersion();
    await withAdminAuth(async () => okResponse())(new Request("http://x/api/v1/media", { method: "GET" }));
    expect(getContentVersion()).toBe(beforeRead);

    await withAdminAuth(async () => new Response("{}", { status: 409 }))(new Request("http://x/api/v1/tags", { method: "POST" }));
    expect(getContentVersion()).toBe(beforeRead);

    await withAdminAuth(async () => okResponse())(new Request("http://x/api/v1/tags", { method: "POST" }));
    expect(getContentVersion()).toBeGreaterThan(beforeRead);
  });
});
