import type { Tag } from "@/types";
import type { TagQueryOptions } from "../query";
import type { IBaseRepository } from "./base";

export interface ITagRepository extends IBaseRepository<Tag, Tag, TagQueryOptions> {
  getBySlug(slug: string): Promise<Tag | undefined>;
}
