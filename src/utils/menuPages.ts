import { pageService } from "@/modules/core/container";
import { MenuPage } from "@/types/menu";
import { logger } from "@/modules/logger";

// The pages the header and footer link to. A failure here must not take the whole public site
// down (the links are a nicety, the catalog is the point), so it degrades to "no links".
export async function getMenuPages(): Promise<MenuPage[]> {
  try {
    const pages = await pageService.getAllPages();
    return pages.filter((p) => p.showInMenu).map((p) => ({ slug: p.slug, title: p.title }));
  } catch (error: unknown) {
    logger.error("Failed to load menu pages", { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}
