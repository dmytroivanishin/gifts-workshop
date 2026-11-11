// Generic CRUD contract every Drizzle repository extends. T is the row type, TPopulated the row with
// its relations filled in, TQueryOptions the filters that repository accepts.
import type { PaginationOptions } from "@/types";

export interface IBaseRepository<T, TPopulated = T, TQueryOptions = PaginationOptions> {
  getAll(options?: TQueryOptions): Promise<TPopulated[]>;
  getById(id: string): Promise<TPopulated | undefined>;
  getByIds(ids: string[]): Promise<TPopulated[]>;
  save(item: T): Promise<TPopulated>;
  saveMany(items: T[]): Promise<TPopulated[]>;
  delete(id: string): Promise<boolean>;
}
