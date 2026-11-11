import type { Collection } from "@/types";
import type { IBaseRepository } from "./base";

export interface ICollectionRepository extends IBaseRepository<Collection> {
  getBySlug(slug: string): Promise<Collection | undefined>;
}
