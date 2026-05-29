import { DrizzleBaseRepository } from "./baseRepository";
import { colors } from "./schema";
import { Color } from "@/types";
import { IColorRepository } from "../interfaces";

export class ColorRepository extends DrizzleBaseRepository<Color, Color> implements IColorRepository {
  constructor() {
    super(colors as any);
  }

  async populate(item: any): Promise<Color> {
    return item as Color;
  }
}

export const colorRepository = new ColorRepository();
