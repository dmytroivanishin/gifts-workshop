import { unstable_cache, revalidateTag } from "next/cache";
import { randomUUID } from "crypto";
import { IPageRepository } from "@/repositories/interfaces";
import { IPageService } from "./interfaces";
import { Page, LocalizedText } from "@/types";
import { ensureUniqueSlug, generateUniqueSlug } from "@/utils/slug";
import { isUUID } from "@/utils/uuid";

// Same unstable_cache + revalidateTag pattern as TagService (CP-26/CP-37): the public header, footer
// and page routes read this list on every request, so it must not hit Postgres each time.
const PAGES_CACHE_TAG = "pages";

export class PageService implements IPageService {
  constructor(private pageRepo: IPageRepository) {}

  private getAllCached = unstable_cache(
    async () => this.pageRepo.getAll(),
    ["pages-get-all"],
    { tags: [PAGES_CACHE_TAG] }
  );

  async getAllPages(): Promise<Page[]> {
    return this.getAllCached();
  }

  async getPageById(id: string): Promise<Page | undefined> {
    if (isUUID(id)) {
      return this.pageRepo.getById(id);
    }
    return this.pageRepo.getBySlug(id);
  }

  async getPageBySlug(slug: string): Promise<Page | undefined> {
    return this.pageRepo.getBySlug(slug);
  }

  async savePage(body: {
    title: LocalizedText;
    description?: LocalizedText;
    showInMenu?: boolean;
    slug?: string;
    id?: string;
    userId?: string;
  }): Promise<Page> {
    const id = body.id || randomUUID();
    const existing = body.id ? await this.pageRepo.getById(id) : undefined;

    // An edit keeps the address it already has unless a new one is sent: the slug is the page's
    // public URL, so it must not change just because the title was edited.
    let slug = body.slug || existing?.slug;
    if (!slug) {
      slug = await generateUniqueSlug(body.title, id, this.pageRepo.getBySlug.bind(this.pageRepo));
    } else if (body.slug) {
      slug = await ensureUniqueSlug(body.slug, id, this.pageRepo.getBySlug.bind(this.pageRepo));
    }

    const page: Page = {
      id,
      slug,
      title: body.title,
      // PUT replaces the page, like every other entity: a missing field is reset, not kept.
      description: body.description ?? {},
      showInMenu: body.showInMenu ?? true,
      userId: body.userId ?? existing?.userId,
    };

    const saved = await this.pageRepo.save(page);
    revalidateTag(PAGES_CACHE_TAG, { expire: 0 });
    return saved;
  }

  async deletePage(id: string): Promise<boolean> {
    const success = await this.pageRepo.delete(id);
    revalidateTag(PAGES_CACHE_TAG, { expire: 0 });
    return success;
  }
}
