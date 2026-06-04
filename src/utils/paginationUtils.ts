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
    limit: isNaN(limit as number) || (limit as number) < 1 ? defaultLimit : limit,
  };
}
