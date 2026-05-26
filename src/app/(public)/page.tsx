"use client";

import { useState, useEffect, Suspense } from "react";
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

  // Fetch posts using RTK Query
  const { data: response, isLoading } = useGetPostsQuery({
    search: search.trim() !== "" ? search : undefined,
    category: activeCategory || undefined,
    inStock: inStockOnly ? true : undefined,
  });

  const posts = response?.data || [];

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
            {dbCategories.map((cat) => {
              const localizedTitle = loc(cat.title);
              const isSelected = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={cn(
                    "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all cursor-pointer",
                    isSelected
                      ? "bg-[#EBE7E3] text-[#1F1B16] border-[#EBE7E3]"
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
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      ) : displayedPosts.length > 0 ? (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-[30px] pb-20">
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
