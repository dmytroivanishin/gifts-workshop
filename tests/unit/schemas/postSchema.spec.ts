import { describe, it, expect } from "vitest";
import { postSchema } from "@/common/validation/schemas";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

const fullPayload = {
  status: "Published" as const,
  title: { en: "A Post" },
  posterId: UUID,
  collectionId: UUID,
  categoryId: UUID,
};

const issuePaths = (result: ReturnType<typeof postSchema.safeParse>) =>
  !result.success ? result.error.issues.map(i => i.path.join(".")) : [];

describe("postSchema (superRefine: Published requires title/posterId/collectionId/categoryId)", () => {
  it("defaults status to Draft when omitted, and does not fire the refine", () => {
    const result = postSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("Draft");
  });

  it("Draft with every field absent passes with no issues", () => {
    const result = postSchema.safeParse({ status: "Draft" });
    expect(result.success).toBe(true);
  });

  it("Archived with every field absent also passes (refine only fires for Published)", () => {
    const result = postSchema.safeParse({ status: "Archived" });
    expect(result.success).toBe(true);
  });

  it("Published with every required field present passes", () => {
    const result = postSchema.safeParse(fullPayload);
    expect(result.success).toBe(true);
  });

  it("Published with all four fields missing produces exactly four issues, one per field", () => {
    const result = postSchema.safeParse({ status: "Published" });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(
      expect.arrayContaining(["title", "posterId", "collectionId", "categoryId"])
    );
    if (!result.success) expect(result.error.issues).toHaveLength(4);
  });

  it.each(["title", "posterId", "collectionId", "categoryId"] as const)(
    "Published with only %s missing produces exactly one issue, at that field's path",
    (missingField) => {
      const payload = { ...fullPayload };
      delete (payload as Record<string, unknown>)[missingField];
      const result = postSchema.safeParse(payload);
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toEqual([missingField]);
    }
  );

  it("treats a title with every locale blank as missing, but any one non-blank locale as present", () => {
    const blankTitle = postSchema.safeParse({ ...fullPayload, title: { en: "", ru: "   " } });
    expect(blankTitle.success).toBe(false);
    expect(issuePaths(blankTitle)).toEqual(["title"]);

    const oneNonBlank = postSchema.safeParse({ ...fullPayload, title: { en: "", ru: "Заголовок" } });
    expect(oneNonBlank.success).toBe(true);
  });
});
