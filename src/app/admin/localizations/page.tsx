"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Languages, CheckCircle2, AlertCircle } from "lucide-react";
import {
  useGetPostsQuery,
  useGetCategoriesQuery,
  useGetTagsQuery,
  useGetCollectionsQuery,
  useGetSystemTextsQuery,
} from "@/store/api";
import { useTranslation } from "@/i18n";
import { LocalizedText } from "@/types";

type EntityType = "post" | "category" | "tag" | "collection" | "system";

// Loose union covering whichever entity is currently selected (post/category/tag/collection/system);
// each branch only reads the couple of fields relevant to it, the same duck-typed access this had under `any`.
interface LocalizableItem {
  id: string;
  title?: LocalizedText | string;
  name?: LocalizedText | string;
  content?: LocalizedText;
  code?: string;
}

export default function AdminLocalizations() {
  const { t, activeLanguages, locale } = useTranslation();
  const router = useRouter();
  
  const [entityType, setEntityType] = useState<EntityType>("post");
  const [page, setPage] = useState(1);
  const limit = 12;

  // Track items locally to allow "Load More" appending
  const [items, setItems] = useState<LocalizableItem[]>([]);

  const isPost = entityType === "post";
  const isCategory = entityType === "category";
  const isTag = entityType === "tag";
  const isCollection = entityType === "collection";
  const isSystem = entityType === "system";

  const { data: postsRes, isFetching: fetchingPosts } = useGetPostsQuery({ page, limit }, { skip: !isPost });
  const { data: categoriesRes, isFetching: fetchingCats } = useGetCategoriesQuery({ page, limit }, { skip: !isCategory });
  const { data: tagsRes, isFetching: fetchingTags } = useGetTagsQuery({ page, limit }, { skip: !isTag });
  const { data: collectionsRes, isFetching: fetchingCols } = useGetCollectionsQuery({ page, limit }, { skip: !isCollection });
  const { data: systemRes, isFetching: fetchingSystem } = useGetSystemTextsQuery({ page, limit }, { skip: !isSystem });

  const isFetching = fetchingPosts || fetchingCats || fetchingTags || fetchingCols || fetchingSystem;
  
  const currentData = isPost ? postsRes : isCategory ? categoriesRes : isTag ? tagsRes : isCollection ? collectionsRes : systemRes;
  const hasMore = currentData?.meta ? currentData.meta.nextPage !== null : false;

  // Reset list when entity type changes
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [entityType]);

  // Append new items when data arrives
  useEffect(() => {
    if (currentData?.data) {
      setItems((prev) => {
        if (page === 1) return currentData.data;
        
        // Prevent duplicates just in case
        const existingIds = new Set(prev.map(i => i.id));
        const newItems = currentData.data.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
    }
  }, [currentData, page]);

  const handleEntityChange = (type: EntityType) => {
    if (type === entityType) return;
    setEntityType(type);
  };

  const handleLoadMore = () => {
    if (!isFetching && hasMore) {
      setPage(p => p + 1);
    }
  };

  const getTranslationStatus = (item: LocalizableItem) => {
    const missing: string[] = [];

    if (isSystem) {
       const content = item.content || {};
       activeLanguages.forEach(lang => {
         if (!content[lang] || content[lang].trim() === "") {
           missing.push(lang.toUpperCase());
         }
       });
    } else {
       const rawTitle = item.title || item.name;
       activeLanguages.forEach(lang => {
         const text = typeof rawTitle === "string" ? rawTitle : rawTitle?.[lang] || "";
         if (text.trim() === "") {
           missing.push(lang.toUpperCase());
         }
       });
    }

    return missing;
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Languages className="text-primary" size={24} />
            {t("translations_title") || "Localizations"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("translations_subtitle") || "Manage content translations"}
          </p>
        </div>
        {isSystem && (
          <button
            onClick={() => router.push('/admin/localizations/system/new')}
            className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors cursor-pointer text-center"
          >
            {t("add_system_text") || "Add System Text"}
          </button>
        )}
      </div>

      {/* Select Entity Controls */}
      <div className="bg-card rounded-xl border border-border/40 p-5 shadow-sm space-y-4">
        <div className="space-y-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("entity_type") || "Entity Type"}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap gap-2">
            {[
              { id: "post", label: t("projects") || "Projects" },
              { id: "category", label: t("categories") || "Categories" },
              { id: "tag", label: t("tags") || "Tags" },
              { id: "collection", label: t("collections") || "Коллекции" },
              { id: "system", label: t("system_texts") !== "system_texts" ? t("system_texts") : "Системные тексты" },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => handleEntityChange(type.id as EntityType)}
                className={`w-full lg:w-auto px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer border ${
                  entityType === type.id 
                    ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                    : "bg-secondary border-border/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Entities Grid */}
      <div className="space-y-6">
        {items.length === 0 && !isFetching ? (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border/40">
            {t("items_not_found") || "No items found"}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((item) => {
              const missingLangs = getTranslationStatus(item);
              const isTranslated = missingLangs.length === 0;
              
              let title = "Untitled";
              if (isSystem) {
                title = item.content?.[locale] || item.content?.ru || item.code || item.id;
              } else {
                const rawTitle = item.title || item.name;
                title = typeof rawTitle === "string" 
                  ? rawTitle 
                  : (rawTitle?.[locale] || rawTitle?.ru || "Untitled");
              }

              return (
                <div
                  key={item.id}
                  onClick={() => router.push(`/admin/localizations/${entityType}/${item.id}`)}
                  className="bg-card rounded-xl border border-border/40 p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between min-h-[120px] group"
                >
                  <h3 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {title}
                  </h3>
                  
                  <div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium">
                    {isTranslated ? (
                      <span className="text-emerald-600 bg-emerald-600/10 px-2 py-1 rounded-md flex items-center gap-1">
                        <CheckCircle2 size={12} /> {t("translated_fully")}
                      </span>
                    ) : (
                      <span className="text-amber-600 bg-amber-600/10 px-2 py-1 rounded-md flex items-center gap-1">
                        <AlertCircle size={12} /> {t("missing_translation")}: {missingLangs.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More & Loading State */}
        <div className="flex justify-center pt-4">
          {isFetching ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" size={16} /> {t("loading_list")}
            </div>
          ) : hasMore ? (
            <button
              onClick={handleLoadMore}
              className="px-6 py-2.5 bg-secondary text-foreground text-sm font-semibold rounded-lg border border-border/40 hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              {t("load_more") !== "load_more" ? t("load_more") : "Загрузить еще"}
            </button>
          ) : items.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              {t("all_items_loaded") !== "all_items_loaded" ? t("all_items_loaded") : "Все элементы загружены"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
