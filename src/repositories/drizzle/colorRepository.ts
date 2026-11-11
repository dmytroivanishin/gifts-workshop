import { DrizzleBaseRepository } from "./baseRepository";
import { colors } from "./schema";
import { Color } from "@/types";
import { desc } from "drizzle-orm";
import { IColorRepository } from "@/interfaces/repositories";

export class ColorRepository extends DrizzleBaseRepository<Color, Color> implements IColorRepository {
  constructor() {
    super(colors);
  }

  async populate(item: typeof colors.$inferSelect): Promise<Color> {
    return item as Color;
  }

  protected override getOrderBy() {
    return desc(colors.createdAt);
  }
}

export const colorRepository = new ColorRepository();
