"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Heart, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils/cn";
import { useGetPostsQuery, useGetCategoriesQuery } from "@/store/api";
import { PostCard } from "@/components/features/PostCard";
import { useTranslation } from "@/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PopulatedCategory, PopulatedPost, PaginatedResult } from "@/types";

interface HomeClientProps {
  initialCategories: PopulatedCategory[];
  initialPosts: PopulatedPost[];
  initialMeta: PaginatedResult<PopulatedPost>["meta"];
}

export default function HomeClient({ initialCategories, initialPosts, initialMeta }: HomeClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, loc } = useTranslation();

  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const categoryNavRef = useRef<HTMLDivElement>(null);

  // Tap-to-toggle subcategory dropdown (mobile has no hover) — close it on an outside click/tap,
  // same pattern as the admin Combobox.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryNavRef.current && !categoryNavRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync activeCategory from search parameters
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (categoryParam) {
      setActiveCategory(categoryParam);
    } else {
      setActiveCategory(undefined);
    }
  }, [searchParams]);

  // Sync likedIds from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const liked = localStorage.getItem("liked_posts");
      if (liked) {
        setLikedIds(JSON.parse(liked) as string[]);
      }
    }
  }, []);

  const handleCategorySelect = (categoryId?: string) => {
    setActiveCategory(categoryId);
    const params = new URLSearchParams(window.location.search);
    if (!categoryId) {
      params.delete("category");
    } else {
      params.set("category", categoryId);
    }
    const newPath = params.toString() ? `/?${params.toString()}` : "/";
    router.push(newPath);
  };

  const handleLikeToggle = (id: string, liked: boolean) => {
    if (liked) {
      setLikedIds((prev) => [...prev, id]);
    } else {
      setLikedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const getCategoryUrl = (categoryId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!categoryId) {
      params.delete("category");
    } else {
      params.set("category", categoryId);
    }
    return params.toString() ? `/?${params.toString()}` : "/";
  };

  // Fetch categories from DB
  const { data: categoriesResponse } = useGetCategoriesQuery();
  // This query's cache key never changes (no args), so categoriesResponse keeps its last good
  // value across refetches — a plain fallback is enough, no "only once" guard needed here.
  const dbCategories = categoriesResponse?.data ?? initialCategories;

  const [page, setPage] = useState(1);

  // Expand parent category selection and strictly resolve slugs to UUIDs on the client!
  let categoryQueryParam = "";
  if (activeCategory && dbCategories.length > 0) {
    const targetCategoryObj = dbCategories.find(
      (c) => c.id === activeCategory || c.slug === activeCategory
    );
    if (targetCategoryObj) {
      if (!targetCategoryObj.parentId) {
        // It is a parent category! Aggregate its ID and all children's IDs
        const children = dbCategories.filter((c) => c.parentId === targetCategoryObj.id);
        const resolvedIds = [targetCategoryObj.id, ...children.map((c) => c.id)];
        categoryQueryParam = resolvedIds.join(",");
      } else {
        // It is a single child category! Just use its ID
        categoryQueryParam = targetCategoryObj.id;
      }
    } else {
      // Fallback if not found in dbCategories list yet
      categoryQueryParam = activeCategory;
    }
  }

  // Fetch posts using RTK Query
  const { data: response, isLoading, isFetching } = useGetPostsQuery({
    category: categoryQueryParam || undefined,
    inStock: inStockOnly ? true : undefined,
    status: "Published",
    page,
    limit: 6,
  });

  // The very first client render always starts with every filter at its default value
  // (search="", no category yet — activeCategory only syncs from the URL in the effect above
  // — inStockOnly=false, page=1), the exact same filters the server used to fetch initialPosts.
  // So until this hook's own first request resolves, fall back to that server-fetched data
  // instead of a spinner. Once any real response has been seen, stop falling back — a later
  // filter change briefly clearing `response` (new cache key) must show its own loading state,
  // not this stale initial snapshot.
  const [hasLiveData, setHasLiveData] = useState(false);
  useEffect(() => {
    if (response !== undefined) setHasLiveData(true);
  }, [response]);

  const posts = response?.data ?? (!hasLiveData ? initialPosts : []);
  const meta = response?.meta ?? (!hasLiveData ? initialMeta : undefined);

  const loaderRef = useRef<HTMLDivElement | null>(null);
  const hasMore = meta?.nextPage != null;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeCategory, inStockOnly, favoritesOnly]);

  // IntersectionObserver bottom anchor logic
  useEffect(() => {
    if (!hasMore || isFetching || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [hasMore, isFetching, isLoading]);

  // Client-side filtering for favorites
  const displayedPosts = favoritesOnly
    ? posts.filter((post) => likedIds.includes(post.id))
    : posts;

  return (
    <div className="container mx-auto px-6 pb-10 pt-4 max-w-[1280px] font-sans">

      {/* Centered Logo */}
      <div className="text-center mb-14 mt-6">
        <Image
          src="/images/logo.png"
          alt="Добрые Подарки"
          width={300}
          height={100}
          priority
          className="mx-auto h-auto w-auto max-w-[300px]"
        />
      </div>

      {/* Controls: Filters */}
      <section aria-label="Filters" className="flex flex-col items-center gap-6 mb-10 pb-10 border-b border-border">
        {/* Categories & Presets Row */}
        <div className="w-full flex justify-center">
          <div ref={categoryNavRef} className="flex items-center gap-3 flex-wrap justify-center">
            {/* Favorites (Heart) Filter */}
            <button
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={cn(
                "flex items-center justify-center py-2 px-3 rounded-full border transition-all cursor-pointer",
                favoritesOnly
                  ? "bg-[#E8D5D5] border-[#E8D5D5] text-[#B87070]"
                  : "bg-transparent border-[#E8D5D5] text-[#B87070] hover:bg-[#E8D5D5]/40"
              )}
              title={t("favorites")}
            >
              <Heart
                size={18}
                className={cn(
                  "transition-transform",
                  favoritesOnly ? "fill-[#B87070] text-[#B87070] scale-110" : "scale-100"
                )}
              />
            </button>

            {/* In Stock Preset */}
            <button
              onClick={() => setInStockOnly(!inStockOnly)}
              className={cn(
                "border px-4 py-2 rounded-full text-[13px] font-normal transition-all cursor-pointer border-[#DADFC6] text-[#7D8945]",
                inStockOnly
                  ? "bg-[#DADFC6] text-[#5C6535]"
                  : "bg-transparent hover:bg-[#DADFC6]/45"
              )}
            >
              {t("in_stock")}
            </button>

            {/* Divider */}
            <span className="w-[1px] h-6 bg-border mx-1" />

            {/* "All" Button */}
            <Link
              href={getCategoryUrl(undefined)}
              className={cn(
                "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all cursor-pointer",
                !activeCategory
                  ? "bg-[#EBE7E3] text-[#1F1B16] border-[#EBE7E3]"
                  : "bg-transparent text-[#827C6B] border-[#EBE7E3] hover:bg-[#EBE7E3]/45"
              )}
            >
              {t("all")}
            </Link>

            {/* Dynamic Categories */}
            {dbCategories
              .filter((cat) => !cat.parentId)
              .map((cat) => {
                const localizedTitle = loc(cat.title);
                const children = dbCategories.filter((c) => c.parentId === cat.id);
                const hasChildren = children.length > 0;

                const isSelected =
                  activeCategory === cat.id ||
                  activeCategory === cat.slug ||
                  children.some((c) => activeCategory === c.id || activeCategory === c.slug);

                if (hasChildren) {
                  const isOpen = openDropdownId === cat.id;
                  return (
                    <div key={cat.id} className="relative group">
                      {/* Parent Category Button: the label navigates (tap/click), the chevron is
                          its own tap target toggling the dropdown — hover alone can't open it on
                          a touch device, which has no hover state at all. */}
                      <div
                        className={cn(
                          "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all flex items-center gap-1.5",
                          isSelected
                            ? "bg-[#EBE7E3] text-[#1F1B16] border-[#EBE7E3] shadow-sm font-semibold"
                            : "bg-transparent text-[#827C6B] border-[#EBE7E3] hover:bg-[#EBE7E3]/45"
                        )}
                      >
                        <Link href={getCategoryUrl(cat.slug || cat.id)} className="cursor-pointer" onClick={() => setOpenDropdownId(null)}>
                          {localizedTitle}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setOpenDropdownId((prev) => (prev === cat.id ? null : cat.id))}
                          aria-expanded={isOpen}
                          aria-label={localizedTitle}
                          className={cn(
                            "text-[9px] opacity-60 transition-transform duration-200 cursor-pointer",
                            isOpen ? "rotate-180" : "group-hover:rotate-180"
                          )}
                        >
                          ▼
                        </button>
                      </div>

                      {/* Glassmorphic Subcategory Dropdown: hover on desktop, tap-toggled (via isOpen) on touch */}
                      <div
                        className={cn(
                          "absolute top-full left-1/2 -translate-x-1/2 mt-1 pt-2.5 z-50 transition-all duration-200 ease-out origin-top",
                          isOpen
                            ? "opacity-100 visible scale-100"
                            : "opacity-0 invisible scale-95 group-hover:opacity-100 group-hover:visible group-hover:scale-100"
                        )}
                      >
                        <div className="bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-2xl p-2 min-w-[200px] flex flex-col gap-1">
                          {/* Option to explicitly select only the parent */}
                          <Link
                            href={getCategoryUrl(cat.slug || cat.id)}
                            onClick={() => setOpenDropdownId(null)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer block",
                              activeCategory === cat.id || activeCategory === cat.slug
                                ? "bg-secondary text-primary font-bold"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {t("all")} {localizedTitle}
                          </Link>
                          <div className="h-[1px] bg-border/60 my-1" />
                          {children.map((child) => {
                            const isChildSelected = activeCategory === child.id || activeCategory === child.slug;
                            return (
                              <Link
                                key={child.id}
                                href={getCategoryUrl(child.slug || child.id)}
                                onClick={() => setOpenDropdownId(null)}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between",
                                  isChildSelected
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                              >
                                <span>{loc(child.title)}</span>
                                {isChildSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Normal Button
                const isDirectlySelected = activeCategory === cat.id || activeCategory === cat.slug;
                return (
                  <Link
                    key={cat.id}
                    href={getCategoryUrl(cat.slug || cat.id)}
                    className={cn(
                      "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all cursor-pointer block",
                      isDirectlySelected
                        ? "bg-[#EBE7E3] text-[#1F1B16] border-[#EBE7E3] shadow-sm font-semibold"
                        : "bg-transparent text-[#827C6B] border-[#EBE7E3] hover:bg-[#EBE7E3]/45"
                    )}
                  >
                    {localizedTitle}
                  </Link>
                );
              })}
          </div>
        </div>
      </section>

      {/* Grid Layout */}
      {displayedPosts.length > 0 ? (
        <>
          <section aria-label="Posts grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[30px] pb-10">
            <AnimatePresence mode="popLayout">
              {displayedPosts.map((post) => (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <PostCard
                    post={post}
                    onLikeToggle={handleLikeToggle}
                    onCategorySelect={handleCategorySelect}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
          {hasMore && (
            <div ref={loaderRef} className="flex items-center justify-center py-10 pb-20">
              <Loader2 className="animate-spin text-[#7D8945] mr-2" size={24} />
              <span className="text-sm text-muted-foreground font-sans">
                {t('loading_more')}
              </span>
            </div>
          )}
        </>
      ) : isLoading && page === 1 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          {t("no_posts_found")}
        </div>
      )}
    </div>
  );
}
