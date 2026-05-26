import { BaseRepository, registerRepository } from "./baseRepository";
import { IColorRepository } from "./interfaces";
import { Color } from "@/types";

export class ColorRepository extends BaseRepository<Color> implements IColorRepository {
  constructor() {
    super("colors");
    registerRepository("colors", this);
  }

  protected override async populate(item: any): Promise<Color> {
    return {
      id: item.id,
      color: item.color || item.colorId || "#FFD2D2",
    };
  }

  protected override serialize(item: any): Color {
    const raw = { ...item };
    const colorId = raw.color || raw.colorId || "#FFD2D2";
    delete raw.color;
    return {
      ...raw,
      colorId,
    } as any;
  }
}
