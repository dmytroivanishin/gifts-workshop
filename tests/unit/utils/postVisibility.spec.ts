import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/utils/auth", () => ({
  isAdminRequest: vi.fn(),
}));

import { resolveStatusFilter, visibleToViewer } from "@/utils/postVisibility";
import { isAdminRequest } from "@/utils/auth";
import { UnauthorizedError } from "@/common/errors/unauthorized";

const mockIsAdmin = (value: boolean) => vi.mocked(isAdminRequest).mockResolvedValue(value);

describe("resolveStatusFilter", () => {
  beforeEach(() => {
    vi.mocked(isAdminRequest).mockReset();
  });

  it('throws Unauthorized when "all" is requested without a valid admin token', async () => {
    mockIsAdmin(false);
    await expect(resolveStatusFilter("all")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('returns no filter (undefined) when "all" is requested by an admin', async () => {
    mockIsAdmin(true);
    await expect(resolveStatusFilter("all")).resolves.toBeUndefined();
  });

  it("passes through whatever status was requested when the caller is an admin", async () => {
    mockIsAdmin(true);
    await expect(resolveStatusFilter("Draft")).resolves.toBe("Draft");
    await expect(resolveStatusFilter(undefined)).resolves.toBeUndefined();
  });

  it("forces Published for a non-admin regardless of what was requested", async () => {
    mockIsAdmin(false);
    await expect(resolveStatusFilter("Draft")).resolves.toBe("Published");
    await expect(resolveStatusFilter(undefined)).resolves.toBe("Published");
  });
});

describe("visibleToViewer", () => {
  beforeEach(() => {
    vi.mocked(isAdminRequest).mockReset();
  });

  it("returns undefined for undefined input without calling isAdminRequest", async () => {
    await expect(visibleToViewer(undefined)).resolves.toBeUndefined();
    expect(isAdminRequest).not.toHaveBeenCalled();
  });

  it("returns a Published post regardless of admin status, without calling isAdminRequest", async () => {
    const post = { status: "Published" as const };
    await expect(visibleToViewer(post)).resolves.toBe(post);
    expect(isAdminRequest).not.toHaveBeenCalled();
  });

  it("returns a non-Published post when the caller is an admin", async () => {
    mockIsAdmin(true);
    const post = { status: "Draft" as const };
    await expect(visibleToViewer(post)).resolves.toBe(post);
  });

  it("returns undefined for a non-Published post when the caller is not an admin", async () => {
    mockIsAdmin(false);
    const post = { status: "Draft" as const };
    await expect(visibleToViewer(post)).resolves.toBeUndefined();
  });
});
