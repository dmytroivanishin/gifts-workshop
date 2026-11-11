import type { Color, PaginatedResult, PaginationOptions } from "@/types";

export interface IColorService {
  getAllColors(options?: PaginationOptions): Promise<PaginatedResult<Color>>;
  getColorById(id: string): Promise<Color | undefined>;
  saveColor(body: { id?: string; color: string; userId?: string }): Promise<Color>;
  deleteColor(id: string): Promise<boolean>;
}
