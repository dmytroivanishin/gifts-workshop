import { unstable_cache, revalidateTag } from "next/cache";
import { IColorRepository, ICategoryRepository } from "@/interfaces/repositories";
import { IColorService } from "@/interfaces/services";
import { Color, PaginatedResult, PaginationOptions } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";

// Same unstable_cache + revalidateTag pattern as SystemTextService/CategoryService (CP-26/CP-37).
// Revalidating this tag also flushes CategoryService's cache (tagged "colors" too, since a
// populated category embeds a live-joined color) in the same call — no separate fan-out needed.
const COLORS_CACHE_TAG = "colors";

export class ColorService implements IColorService {
  constructor(
    private colorRepo: IColorRepository,
    private categoryRepo: ICategoryRepository
  ) {}

  private getAllCached = unstable_cache(
    async (options?: PaginationOptions) => this.colorRepo.getAll(options),
    ["colors-get-all"],
    { tags: [COLORS_CACHE_TAG] }
  );

  async getAllColors(options?: PaginationOptions): Promise<PaginatedResult<Color>> {
    if (options?.page || options?.limit) {
      const page = options.page || 1;
      const limit = options.limit || 20;

      const colors = await this.getAllCached({
        page,
        limit: limit + 1,
        offset: (page - 1) * limit,
      });

      return paginate(colors, { page, limit });
    }

    const colors = await this.getAllCached();
    return paginate(colors, { page: 1, limit: colors.length });
  }

  async getColorById(id: string): Promise<Color | undefined> {
    return this.colorRepo.getById(id);
  }

  async saveColor(body: { id?: string; color: string; userId?: string }): Promise<Color> {
    const id = body.id || randomUUID();
    const color: Color = {
      id,
      color: body.color,
    };
    const savedColor = await this.colorRepo.save(color);

    // If we're updating an existing color, bulk-update all categories referencing this color ID
    if (body.id) {
      await this.categoryRepo.updateColorInCategories(savedColor.id, savedColor.color);
    }

    revalidateTag(COLORS_CACHE_TAG, { expire: 0 });
    return savedColor;
  }

  async deleteColor(id: string): Promise<boolean> {
    const success = await this.colorRepo.delete(id);
    revalidateTag(COLORS_CACHE_TAG, { expire: 0 });
    return success;
  }
}
