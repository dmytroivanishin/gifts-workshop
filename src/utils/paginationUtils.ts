// Without a cap, `?limit=1000000` on a public list loads the whole table with its relations
export const MAX_PAGE_SIZE = 100;

// A search term longer than this is cut: nothing real needs more, and the term is placed into an ILIKE pattern.
const MAX_SEARCH_LENGTH = 100;

// Reads `?search=`, cut to MAX_SEARCH_LENGTH; an empty term means no search.
export function getSearchParam(request: Request): string | undefined {
  return new URL(request.url).searchParams.get("search")?.slice(0, MAX_SEARCH_LENGTH) || undefined;
}

export function getPaginationParams(request: Request, defaultPage?: number, defaultLimit?: number) {
  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");
  const limitParam = url.searchParams.get("limit");

  if (!pageParam && !limitParam && defaultPage === undefined && defaultLimit === undefined) {
    return { page: undefined, limit: undefined };
  }

  const page = pageParam ? parseInt(pageParam, 10) : defaultPage;
  const limit = limitParam ? parseInt(limitParam, 10) : defaultLimit;

  return {
    page: isNaN(page as number) || (page as number) < 1 ? defaultPage : page,
    limit: isNaN(limit as number) || (limit as number) < 1 ? defaultLimit : Math.min(limit as number, MAX_PAGE_SIZE),
  };
}
