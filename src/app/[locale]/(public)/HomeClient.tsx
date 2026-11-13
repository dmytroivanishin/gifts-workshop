"use client";

import { useState, useEffect, useRef, useMemo, type CSSProperties } from "react";
import Image from "next/image";
import { Heart, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils/cn";
import { useGetPostsQuery, useGetCategoriesQuery, useGetTagByIdQuery } from "@/store/api";
import { PostCard } from "@/components/features/PostCard";
import { useTranslation } from "@/i18n";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getChildCategories, isCategoryActive } from "@/utils/categoryTree";
import { PopulatedCategory, PopulatedPost, PaginatedResult } from "@/types";

interface HomeClientProps {
  initialCategories: PopulatedCategory[];
  initialPosts: PopulatedPost[];
  initialMeta: PaginatedResult<PopulatedPost>["meta"];
}

// A category pill takes the colour the admin picked for that category (same hex the post card badge
// uses); a category without one falls back to the neutral beige of the "All" pill.
function categoryTone(hex: string | undefined, selected: boolean): { className: string; style?: CSSProperties } {
  if (!hex) {
    return {
      className: selected
        ? "bg-secondary text-[#1F1B16] border-border"
        : "bg-transparent text-muted-foreground border-border hover:bg-secondary/45",
    };
  }
  return {
    className: selected ? "" : "hover:bg-(--cat-soft)",
    style: {
      color: hex,
      // Same rule as the neutral pills: the outline stays as is and the selected fill is that
      // very outline colour (it must not get darker when selected).
      borderColor: `${hex}29`,
      backgroundColor: selected ? `${hex}29` : undefined,
      // Without this the translucent fill also sits under the translucent border, doubling it up.
      backgroundClip: "padding-box",
      "--cat-soft": `${hex}12`,
    } as CSSProperties,
  };
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
  const compactNavRef = useRef<HTMLDivElement>(null);
  const navWrapperRef = useRef<HTMLDivElement>(null);
  // The filter bar is one centered row while everything fits, and switches to a compact, grouped
  // layout as soon as that row would have to wrap. `compactState.key` ties the flag to the data it
  // was measured for: when categories or language change the flag is stale, so it is ignored and the
  // wide layout is re-measured.
  const [compactState, setCompactState] = useState<{ value: boolean; key: string }>({ value: false, key: "" });
  // Natural (single-row) width of the wide layout, remembered when it was measured so we know when
  // enough room is back to return to it.
  const naturalWidthRef = useRef(0);

  // Tap-to-toggle subcategory dropdown (mobile has no hover) — close it on an outside click/tap,
  // same pattern as the admin Combobox.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const nav = categoryNavRef.current ?? compactNavRef.current;
      if (nav && !nav.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The tag filter lives only in the URL (a post page's tag chip links here with ?tag=<slug>), so it
  // is read straight from it rather than mirrored into state. It replaces the category filter.
  const activeTag = searchParams.get("tag") || undefined;
  const { data: activeTagResponse } = useGetTagByIdQuery(activeTag ?? "", { skip: !activeTag });
  const activeTagName = activeTagResponse?.data ? loc(activeTagResponse.data.name) : activeTag;

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
    params.delete("tag"); // choosing a category replaces a tag filter
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
    params.delete("tag"); // choosing a category (or "All") replaces a tag filter
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
      (category) => category.id === activeCategory || category.slug === activeCategory
    );
    if (targetCategoryObj) {
      if (!targetCategoryObj.parentId) {
        // It is a parent category! Aggregate its ID and all children's IDs
        const children = getChildCategories(dbCategories, targetCategoryObj.id);
        const resolvedIds = [targetCategoryObj.id, ...children.map((child) => child.id)];
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
    tag: activeTag,
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

  // The server-fetched initial posts are the unfiltered first page, so a tag deep link must not show them.
  const canUseInitialData = !hasLiveData && !activeTag;
  const posts = response?.data ?? (canUseInitialData ? initialPosts : []);
  const meta = response?.meta ?? (canUseInitialData ? initialMeta : undefined);

  const loaderRef = useRef<HTMLDivElement | null>(null);
  const hasMore = meta?.nextPage != null;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeCategory, activeTag, inStockOnly, favoritesOnly]);

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

  const topLevelCategories = dbCategories.filter((category) => !category.parentId);
  const selectedParent = topLevelCategories.find((category) => {
    const children = getChildCategories(dbCategories, category.id);
    return (
      children.length > 0 &&
      (isCategoryActive(category, activeCategory) ||
        children.some((child) => isCategoryActive(child, activeCategory)))
    );
  });
  // Compact layout: the subcategory tier is open only while its parent's chevron is toggled on.
  const openParent = topLevelCategories.find((category) => category.id === openDropdownId);
  const openParentChildren = openParent ? getChildCategories(dbCategories, openParent.id) : [];

  const navDataKey = useMemo(
    () => topLevelCategories.map((category) => `${category.id}:${loc(category.title)}`).join("|") + "#" + dbCategories.length,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- topLevelCategories/loc are derived from these
    [dbCategories, loc]
  );
  const isCompact = compactState.value && compactState.key === navDataKey;

  useEffect(() => {
    const wrapper = navWrapperRef.current;
    if (!wrapper) return;
    const check = () => {
      if (isCompact) {
        // +2px hysteresis so a rounding difference can't make the two layouts flip back and forth.
        if (wrapper.clientWidth >= naturalWidthRef.current + 2) setCompactState({ value: false, key: navDataKey });
        return;
      }
      const row = categoryNavRef.current;
      if (!row) return;
      const items = Array.from(row.children) as HTMLElement[];
      if (items.length < 2) return;
      // Items are vertically centered, so same-row items can differ by a pixel or two in offsetTop.
      const wrapped = items.some((item) => item.offsetTop - items[0].offsetTop > 8);
      if (!wrapped) return;
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      naturalWidthRef.current = items.reduce((sum, item) => {
        const cs = getComputedStyle(item);
        return sum + item.getBoundingClientRect().width + (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0);
      }, gap * (items.length - 1));
      setCompactState({ value: true, key: navDataKey });
    };
    const observer = new ResizeObserver(check);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [navDataKey, isCompact]);

  // Client-side filtering for favorites
  const displayedPosts = favoritesOnly
    ? posts.filter((post) => likedIds.includes(post.id))
    : posts;

  // Shown while a tag filter is on: it is the active pill, and following it (or "All") clears the tag.
  const tagFilterChip = activeTag ? (
    <Link
      href={getCategoryUrl(undefined)}
      title={t("clear_tag_filter")}
      aria-label={`${t("clear_tag_filter")}: #${activeTagName}`}
      className="flex items-center gap-1.5 border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all cursor-pointer bg-secondary text-[#1F1B16] border-border"
    >
      #{activeTagName}
      <X size={14} aria-hidden="true" />
    </Link>
  ) : null;

  const favoritesButton = (
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
  );

  const inStockButton = (

    <button
      onClick={() => setInStockOnly(!inStockOnly)}
      className={cn(
        "border px-4 py-2 rounded-full text-[13px] font-normal transition-all cursor-pointer border-lime-active text-[#7D8945]",
        inStockOnly
          ? "bg-lime-active text-lime-text"
          : "bg-transparent hover:bg-lime-active/45"
      )}
    >
      {t("in_stock")}
    </button>
  );

  return (
    <div className="container mx-auto px-6 pb-10 pt-4 max-w-[1280px] font-sans">

      {/* Centered Logo */}
      <div className="mx-auto max-w-[255px] md:max-w-[300px] text-center mb-8 md:mb-14 -mt-2 md:mt-6">
        <Image
          src="/images/logo.png"
          alt="Добрые Подарки"
          width={300}
          height={100}
          priority
          className="mx-auto h-auto w-auto max-w-full"
        />
      </div>

      {/* Controls: Filters */}
      <section aria-label="Filters" className="flex flex-col items-center gap-6 mb-10 pb-10 border-b border-border">
        {/* Categories & Presets Row */}
        <div ref={navWrapperRef} className="w-full flex justify-center">
          {!isCompact ? (
            <div ref={categoryNavRef} className="flex items-center gap-3 flex-wrap justify-center">
              {favoritesButton}
              {inStockButton}

              {/* Divider */}
              <span className="w-[1px] h-6 bg-border mx-1" />

              {/* "All" Button */}
              <Link
                href={getCategoryUrl(undefined)}
                className={cn(
                  "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all cursor-pointer",
                  !activeCategory && !activeTag
                    ? "bg-secondary text-[#1F1B16] border-border"
                    : "bg-transparent text-muted-foreground border-border hover:bg-secondary/45"
                )}
              >
                {t("all")}
              </Link>
              {tagFilterChip}

              {/* Dynamic Categories */}
              {dbCategories
                .filter((category) => !category.parentId)
                .map((category) => {
                  const localizedTitle = loc(category.title);
                  const children = getChildCategories(dbCategories, category.id);
                  const hasChildren = children.length > 0;

                  const isSelected =
                    isCategoryActive(category, activeCategory) ||
                    children.some((child) => isCategoryActive(child, activeCategory));

                  if (hasChildren) {
                    const isOpen = openDropdownId === category.id;
                    return (
                      <div key={category.id} className="relative group">
                        {/* Parent Category Button: the label navigates (tap/click), the chevron is
                            its own tap target toggling the dropdown — hover alone can't open it on
                            a touch device, which has no hover state at all. */}
                        <div
                          className={cn(
                            "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all flex items-center gap-1.5",
                            categoryTone(category.color?.color, isSelected).className
                          )}
                          style={categoryTone(category.color?.color, isSelected).style}
                        >
                          <Link href={getCategoryUrl(category.slug || category.id)} className="cursor-pointer" onClick={() => setOpenDropdownId(null)}>
                            {localizedTitle}
                          </Link>
                          <button
                            type="button"
                            onClick={() => setOpenDropdownId((prev) => (prev === category.id ? null : category.id))}
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
                          <div className="bg-card/95 backdrop-blur-md border border-border rounded-2xl p-2 min-w-[200px] flex flex-col gap-1">
                            {/* Only the subcategories: the parent pill itself already selects the parent.
                                A subcategory takes its own colour, else its parent's, and is lit by the
                                same rule as the top-level pills. */}
                            {children.map((child) => {
                              const isChildSelected = isCategoryActive(child, activeCategory);
                              const tone = categoryTone(child.color?.color ?? category.color?.color, isChildSelected);
                              return (
                                <Link
                                  key={child.id}
                                  href={getCategoryUrl(child.slug || child.id)}
                                  onClick={() => setOpenDropdownId(null)}
                                  className={cn(
                                    "w-full text-left border px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer block",
                                    tone.className
                                  )}
                                  style={tone.style}
                                >
                                  {loc(child.title)}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Normal Button
                  const isDirectlySelected = isCategoryActive(category, activeCategory);
                  return (
                    <Link
                      key={category.id}
                      href={getCategoryUrl(category.slug || category.id)}
                      className={cn(
                        "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all cursor-pointer block",
                        categoryTone(category.color?.color, isDirectlySelected).className
                      )}
                      style={categoryTone(category.color?.color, isDirectlySelected).style}
                    >
                      {localizedTitle}
                    </Link>
                  );
                })}
            </div>
          ) : (
            <div ref={compactNavRef} className="flex w-full flex-col items-center gap-3">
              {/* Quick filters get their own row, so they never end up split from each other */}
              <div className="flex items-center justify-center gap-2">
                {favoritesButton}
                {inStockButton}
              </div>

              {/* Categories wrap freely; layout="position" makes them glide to their new place on resize */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <motion.div layout="position">
                  <Link
                    href={getCategoryUrl(undefined)}
                    className={cn(
                      "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all cursor-pointer block",
                      !activeCategory && !activeTag
                        ? "bg-secondary text-[#1F1B16] border-border"
                        : "bg-transparent text-muted-foreground border-border hover:bg-secondary/45"
                    )}
                  >
                    {t("all")}
                  </Link>
                </motion.div>
                {tagFilterChip && <motion.div layout="position">{tagFilterChip}</motion.div>}
                {topLevelCategories.map((category) => {
                  const hasChildren = getChildCategories(dbCategories, category.id).length > 0;
                  const isSelected = selectedParent?.id === category.id || isCategoryActive(category, activeCategory);
                  const tone = categoryTone(category.color?.color, isSelected);
                  const isOpen = openDropdownId === category.id;
                  return (
                    <motion.div key={category.id} layout="position">
                      {/* Same split as the desktop pill: the label selects the category, the chevron
                          (its own tap target) toggles the subcategory row. */}
                      <div
                        className={cn(
                          "border px-4 py-2 rounded-full text-[0.85rem] font-sans font-normal transition-all flex items-center gap-1.5",
                          tone.className
                        )}
                        style={tone.style}
                      >
                        <Link
                          href={getCategoryUrl(category.slug || category.id)}
                          className="cursor-pointer"
                          onClick={() => setOpenDropdownId(null)}
                        >
                          {loc(category.title)}
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => setOpenDropdownId((prev) => (prev === category.id ? null : category.id))}
                            aria-expanded={isOpen}
                            aria-label={loc(category.title)}
                            className={cn("text-[9px] opacity-60 transition-transform duration-200 cursor-pointer", isOpen && "rotate-180")}
                          >
                            ▼
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Subcategories of the parent whose chevron is toggled open appear as a second tier under the row, instead of a
                  hover dropdown that can run off a narrow screen and needs a tap target on touch. */}
              <AnimatePresence initial={false}>
                {openParent && (
                  <motion.div
                    key={openParent.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="w-full overflow-hidden"
                  >
                    {/* The very same panel as the desktop dropdown: card background, border, stacked rows. */}
                    <div className="mx-auto flex w-fit min-w-[200px] max-w-full flex-col gap-1 rounded-2xl border border-border bg-card/95 p-2 backdrop-blur-md">
                      {openParentChildren.map((child) => {
                        const isChildSelected = isCategoryActive(child, activeCategory);
                        const tone = categoryTone(child.color?.color ?? openParent.color?.color, isChildSelected);
                        return (
                          <Link
                            key={child.id}
                            href={getCategoryUrl(child.slug || child.id)}
                            onClick={() => setOpenDropdownId(null)}
                            className={cn(
                              "w-full text-left border px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer block",
                              tone.className
                            )}
                            style={tone.style}
                          >
                            {loc(child.title)}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
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
