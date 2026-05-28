"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import { Heart, Loader2, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useGetPostsQuery, useGetCategoriesQuery } from "@/store/api";
import { ProjectCard } from "@/components/features/ProjectCard";
import { useTranslation } from "@/i18n";
import { useRouter, useSearchParams } from "next/navigation";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, loc, locale, setLocale } = useTranslation();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [likedIds, setLikedIds] = useState<string[]>([]);

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
      const liked = localStorage.getItem("liked_projects");
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

  // Fetch categories from DB
  const { data: categoriesResponse } = useGetCategoriesQuery();
  const dbCategories = categoriesResponse?.data || [];

  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);

  // Expand parent category selection and strictly resolve slugs to UUIDs on the client!
  let categoryQueryParam = "";
  if (activeCategory && dbCategories.length > 0) {
    const targetCategoryObj = dbCategories.find(
      (c: any) => c.id === activeCategory || c.slug === activeCategory
    );
    if (targetCategoryObj) {
      if (!targetCategoryObj.parentId) {
        // It is a parent category! Aggregate its ID and all children's IDs
        const children = dbCategories.filter((c: any) => c.parentId === targetCategoryObj.id);
        const resolvedIds = [targetCategoryObj.id, ...children.map((c: any) => c.id)];
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
    search: search.trim() !== "" ? search : undefined,
    category: categoryQueryParam || undefined,
    inStock: inStockOnly ? true : undefined,
    page,
    limit: 6,
    populate: "category,media",
  });

  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, activeCategory, inStockOnly, favoritesOnly]);

  // Sync loaded page chunk to accumulated posts list
  useEffect(() => {
    if (response?.data) {
      if (page === 1) {
        setPosts(response.data);
      } else {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newPosts = response.data.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
      setHasMore(response.meta?.nextPage !== null);
    }
  }, [response, page]);

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
    <div className="container mx-auto px-6 py-10 max-w-[1280px] font-sans">
      
      {/* Locale Selector */}
      <div className="flex items-center justify-between mt-2 mb-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe size={14} />
          <button
            onClick={() => setLocale(locale === "ru" ? "en" : "ru")}
            className="hover:text-foreground font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {locale === "ru" ? "English" : "Русский"}
          </button>
        </div>
        {/* Admin panel link has been removed from the public website for privacy */}
        <div />
      </div>

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

      {/* Controls: Search & Filters */}
      <div className="flex flex-col items-center gap-6 mb-10 pb-10 border-b border-border">
        {/* Search Input */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_placeholder")}
          className="w-full max-w-[400px] px-5 py-3 rounded-full border border-border bg-transparent text-base text-foreground outline-none transition-colors focus:border-muted-foreground"
        />

        {/* Categories & Presets Row */}
        <div className="w-full flex justify-center">
          <div className="flex items-center gap-3 flex-wrap justify-center">
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
            <button
              onClick={() => handleCategorySelect(undefined)}
              className={cn(
                "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all cursor-pointer",
                !activeCategory
                  ? "bg-[#EBE7E3] text-[#1F1B16] border-[#EBE7E3]"
                  : "bg-transparent text-[#827C6B] border-[#EBE7E3] hover:bg-[#EBE7E3]/45"
              )}
            >
              {t("all")}
            </button>

            {/* Dynamic Categories */}
            {dbCategories
              .filter((cat: any) => !cat.parentId)
              .map((cat: any) => {
                const localizedTitle = loc(cat.title);
                const children = dbCategories.filter((c: any) => c.parentId === cat.id);
                const hasChildren = children.length > 0;

                const isSelected =
                  activeCategory === cat.id ||
                  activeCategory === cat.slug ||
                  children.some((c: any) => activeCategory === c.id || activeCategory === c.slug);

                if (hasChildren) {
                  return (
                    <div key={cat.id} className="relative group">
                      {/* Parent Category Button */}
                      <button
                        onClick={() => handleCategorySelect(cat.slug || cat.id)}
                        className={cn(
                          "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all cursor-pointer flex items-center gap-1.5",
                          isSelected
                            ? "bg-[#EBE7E3] text-[#1F1B16] border-[#EBE7E3] shadow-sm font-semibold"
                            : "bg-transparent text-[#827C6B] border-[#EBE7E3] hover:bg-[#EBE7E3]/45"
                        )}
                      >
                        {localizedTitle}
                        <span className="text-[9px] opacity-60 transition-transform duration-200 group-hover:rotate-180">▼</span>
                      </button>

                      {/* Glassmorphic Subcategory Hover Dropdown */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 pt-2.5 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out scale-95 group-hover:scale-100 origin-top">
                        <div className="bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-2xl p-2 min-w-[200px] flex flex-col gap-1">
                          {/* Option to explicitly select only the parent */}
                          <button
                            onClick={() => handleCategorySelect(cat.slug || cat.id)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer",
                              activeCategory === cat.id || activeCategory === cat.slug
                                ? "bg-secondary text-primary font-bold"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {t("all")} {localizedTitle}
                          </button>
                          <div className="h-[1px] bg-border/60 my-1" />
                          {children.map((child: any) => {
                            const isChildSelected = activeCategory === child.id || activeCategory === child.slug;
                            return (
                              <button
                                key={child.id}
                                onClick={() => handleCategorySelect(child.slug || child.id)}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between",
                                  isChildSelected
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                              >
                                <span>{loc(child.title)}</span>
                                {isChildSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                              </button>
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
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.slug || cat.id)}
                    className={cn(
                      "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all cursor-pointer",
                      isDirectlySelected
                        ? "bg-[#EBE7E3] text-[#1F1B16] border-[#EBE7E3] shadow-sm font-semibold"
                        : "bg-transparent text-[#827C6B] border-[#EBE7E3] hover:bg-[#EBE7E3]/45"
                    )}
                  >
                    {localizedTitle}
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Masonry Grid */}
      {isLoading && page === 1 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      ) : displayedPosts.length > 0 ? (
        <>
          <div className="columns-1 md:columns-2 lg:columns-3 gap-[30px] pb-10">
            <AnimatePresence mode="popLayout">
              {displayedPosts.map((post) => (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="break-inside-avoid"
                >
                  <ProjectCard
                    post={post}
                    onLikeToggle={handleLikeToggle}
                    onCategorySelect={handleCategorySelect}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {hasMore && (
            <div ref={loaderRef} className="flex items-center justify-center py-10 pb-20">
              <Loader2 className="animate-spin text-[#7D8945] mr-2" size={24} />
              <span className="text-sm text-muted-foreground font-sans">
                {locale === "ru" ? "Загружаем ещё красоты..." : "Loading more beautiful works..."}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          {t("no_projects_found")}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
