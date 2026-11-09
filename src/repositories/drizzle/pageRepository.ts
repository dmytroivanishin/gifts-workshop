import { DrizzleBaseRepository } from "./baseRepository";
import { pages } from "./schema";
import { Page } from "@/types";
import { drizzleDatabase } from "./database";
import { eq, asc } from "drizzle-orm";
import { IPageRepository } from "../interfaces";
import { PaginationOptions } from "@/types";

export class PageRepository extends DrizzleBaseRepository<Page, Page, PaginationOptions> implements IPageRepository {
  constructor() {
    super(pages);
  }

  async populate(item: typeof pages.$inferSelect): Promise<Page> {
    return item as Page;
  }

  // Oldest first: the menu order is the order the pages were created in ("About" before "Delivery").
  protected override getOrderBy() {
    return asc(pages.createdAt);
  }

  async getBySlug(slug: string): Promise<Page | undefined> {
    const records = await drizzleDatabase.getDb().select().from(pages).where(eq(pages.slug, slug)).limit(1);
    return records.length ? this.populate(records[0]) : undefined;
  }
}

export const pageRepository = new PageRepository();
