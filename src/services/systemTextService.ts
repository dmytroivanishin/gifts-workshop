import { unstable_cache, revalidateTag } from "next/cache";
import { ISystemTextRepository, QueryOptions } from "@/repositories/interfaces";
import { ISystemTextService } from "./interfaces";
import { SystemText, PaginatedResult } from "@/types";
import { paginate } from "./pagination";

// Not using Next 16's Cache Components ("use cache"): next.config.ts doesn't set the
// cacheComponents flag project-wide, so unstable_cache (the pre-16 caching API, still
// supported) is the right tool here rather than switching the whole app's caching model.
const SYSTEM_TEXTS_CACHE_TAG = "system-texts";

export class SystemTextService implements ISystemTextService {
  constructor(private systemTextRepo: ISystemTextRepository) {}

  // Cached indefinitely (no revalidate interval) until saveSystemText/deleteSystemText below
  // call revalidateTag: system_texts only ever changes through the admin editor, but the root
  // layout re-ran this query against Postgres on every single request to every page.
  private getAllCached = unstable_cache(
    async (options?: QueryOptions) => this.systemTextRepo.getAll(options),
    ["system-texts-get-all"],
    { tags: [SYSTEM_TEXTS_CACHE_TAG] }
  );

  async getAllSystemTexts(options?: QueryOptions): Promise<PaginatedResult<SystemText>> {
    const page = options?.page || 1;
    const limit = options?.limit || 100;

    // Note: To properly support pagination locally in memory, we fetch one extra
    // to let `paginate` know if there is a next page. If options.area is used,
    // it filters at DB level. Then we slice it.
    const allTexts = await this.getAllCached(options);

    const startIndex = (page - 1) * limit;
    const textsForPage = allTexts.slice(startIndex, startIndex + limit + 1);

    return paginate(textsForPage, { page, limit });
  }

  async getSystemTextById(id: string): Promise<SystemText | undefined> {
    return this.systemTextRepo.getById(id);
  }

  async saveSystemText(body: any): Promise<SystemText> {
    const text: any = {
      content: body.content,
      code: body.code,
      area: body.area || "admin",
    };
    if (body.id) {
      text.id = body.id;
    }
    const saved = await this.systemTextRepo.save(text as SystemText);
    // { expire: 0 }, not "max": an admin edit should be visible on the very next request,
    // not served stale-while-revalidate in the background.
    revalidateTag(SYSTEM_TEXTS_CACHE_TAG, { expire: 0 });
    return saved;
  }

  async deleteSystemText(id: string): Promise<boolean> {
    const success = await this.systemTextRepo.delete(id);
    revalidateTag(SYSTEM_TEXTS_CACHE_TAG, { expire: 0 });
    return success;
  }
}
