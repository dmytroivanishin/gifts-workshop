import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { categoryService, postService } from "@/modules/core/container";
import HomeClient from "./HomeClient";

// Server component: fetches the same default, unfiltered first page the client's own
// useGetCategoriesQuery/useGetPostsQuery would fetch on mount, directly via the service layer
// (same pattern layout.tsx's generateMetadata and sitemap.ts already use). HomeClient is
// otherwise unchanged — same hooks, same interactivity — this only replaces what renders before
// those hooks' own fetch resolves, so a crawler's raw HTML already contains real post cards.
//
// Scoped to the default view only: activeCategory in HomeClient starts undefined and only syncs
// from the URL's ?category= param in a useEffect (after mount), so the client's very first render
// is always unfiltered regardless of the URL — matching what's fetched here. A category deep link
// still briefly shows all posts before settling on the filtered set once that effect runs, exactly
// the same timing the app already has today (previously: spinner, then filtered; now: all posts,
// then filtered) — pre-filtering the server fetch too would need a client-side change to how
// activeCategory initializes, intentionally left alone here to keep this change minimal.
export default async function HomePage() {
  const [categoriesResult, postsResult] = await Promise.all([
    categoryService.getAllCategories(),
    postService.getFilteredPosts({ status: "Published", page: 1, limit: 6 }),
  ]);

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    }>
      <HomeClient
        initialCategories={categoriesResult.data}
        initialPosts={postsResult.data}
        initialMeta={postsResult.meta}
      />
    </Suspense>
  );
}
