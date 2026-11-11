import type { LocalizedText, Page } from "@/types";

export interface IPageService {
  getAllPages(): Promise<Page[]>;
  getPageById(id: string): Promise<Page | undefined>;
  getPageBySlug(slug: string): Promise<Page | undefined>;
  savePage(body: { title: LocalizedText; description?: LocalizedText; showInMenu?: boolean; slug?: string; id?: string; userId?: string }): Promise<Page>;
  deletePage(id: string): Promise<boolean>;
}
