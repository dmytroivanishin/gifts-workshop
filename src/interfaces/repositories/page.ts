import type { Page, PaginationOptions } from "@/types";
import type { IBaseRepository } from "./base";

export interface IPageRepository extends IBaseRepository<Page, Page, PaginationOptions> {
  getBySlug(slug: string): Promise<Page | undefined>;
}
