import type { Media } from "@/types";
import type { MediaQueryOptions } from "../query";
import type { IBaseRepository } from "./base";

export interface IMediaRepository extends IBaseRepository<Media, Media, MediaQueryOptions> {
  deleteMany(ids: string[]): Promise<string[]>;
  findByContentHash(hash: string): Promise<Media | undefined>;
  // Which of the given URLs some media row uses (as its original or its thumbnail). One query per call.
  findUrlsIn(urls: string[]): Promise<string[]>;
}
