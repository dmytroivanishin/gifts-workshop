import { IColorRepository, ICategoryRepository } from "@/repositories/interfaces";
import { IColorService } from "./interfaces";
import { Color, PaginatedResult, PaginationOptions } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";

export class ColorService implements IColorService {
  constructor(
    private colorRepo: IColorRepository,
    private categoryRepo: ICategoryRepository
  ) {}

  async getAllColors(options?: PaginationOptions): Promise<PaginatedResult<Color>> {
    if (options?.page || options?.limit) {
      const page = options.page || 1;
      const limit = options.limit || 20;

      const colors = await this.colorRepo.getAll({
        page,
        limit: limit + 1,
        offset: (page - 1) * limit,
      });

      return paginate(colors, { page, limit });
    }

    const colors = await this.colorRepo.getAll();
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

    return savedColor;
  }

  async deleteColor(id: string): Promise<boolean> {
    return this.colorRepo.delete(id);
  }
}
