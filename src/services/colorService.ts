import { IColorRepository } from "@/repositories/interfaces";
import { IColorService } from "./interfaces";
import { Color } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";

export class ColorService implements IColorService {
  constructor(private colorRepo: IColorRepository) {}

  async getAllColors(options?: any): Promise<any> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const colors = await this.colorRepo.getAll({
      page,
      limit: limit + 1,
    });

    return paginate(colors, { page, limit });
  }

  async getColorById(id: string): Promise<Color | undefined> {
    return this.colorRepo.getById(id);
  }

  async saveColor(body: any): Promise<Color> {
    const id = body.id || randomUUID();
    const color: Color = {
      id,
      color: body.color,
    };
    return this.colorRepo.save(color);
  }

  async deleteColor(id: string): Promise<boolean> {
    return this.colorRepo.delete(id);
  }
}
