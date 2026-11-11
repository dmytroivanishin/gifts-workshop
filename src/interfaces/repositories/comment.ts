import type { Comment, PaginationOptions, PopulatedComment } from "@/types";
import type { QueryOptions } from "../query";
import type { IBaseRepository } from "./base";

export interface ICommentRepository extends IBaseRepository<Comment, PopulatedComment, QueryOptions> {
  getByQuery(query: QueryOptions, options?: PaginationOptions): Promise<PopulatedComment[]>;
}
