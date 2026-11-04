import { describe, it, expect, vi } from "vitest";
import { ColorService } from "@/services/colorService";
import type { IColorRepository, ICategoryRepository } from "@/repositories/interfaces";
import type { Color } from "@/types";

// Hand-rolled repo stubs, same convention as categoryService.spec.ts — only the method
// getAllColors actually calls, no DB involved. categoryRepo is unused by getAllColors itself
// (only by saveColor) but is a required constructor arg.
const makeColorRepo = (colors: Color[] = []) =>
  ({
    getAll: vi.fn().mockResolvedValue(colors),
  }) as unknown as IColorRepository;

const makeCategoryRepo = () => ({}) as unknown as ICategoryRepository;

const color = (id: string): Color => ({ id, color: "#000000" });

// CP-40 regression: this service previously applied `limit: 20` unconditionally, even when the
// caller passed no pagination args at all — these two tests pin the fixed "no args = everything,
// args = paginated" branching directly, independent of the real DB (tests/api/colors.spec.ts
// covers the same fix end-to-end against Postgres).
describe("ColorService.getAllColors", () => {
  it("with no args, calls repo.getAll with no options at all and returns everything", async () => {
    const colors = Array.from({ length: 25 }, (_, i) => color(`c${i}`));
    const repo = makeColorRepo(colors);
    const service = new ColorService(repo, makeCategoryRepo());

    const result = await service.getAllColors();

    expect(repo.getAll).toHaveBeenCalledWith();
    expect(result.data).toHaveLength(25);
    expect(result.meta.nextPage).toBeNull();
  });

  it("with page/limit, computes offset and requests limit+1 as the next-page probe", async () => {
    const repo = makeColorRepo(Array.from({ length: 6 }, (_, i) => color(`c${i}`)));
    const service = new ColorService(repo, makeCategoryRepo());

    await service.getAllColors({ page: 2, limit: 5 });

    expect(repo.getAll).toHaveBeenCalledWith({ page: 2, limit: 6, offset: 5 });
  });
});
