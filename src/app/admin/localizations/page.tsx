"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Languages, CheckCircle2, AlertCircle } from "lucide-react";
import {
  useGetPostsQuery,
  useGetCategoriesQuery,
  useUpdatePostMutation,
  useUpdateCategoryMutation,
} from "@/store/api";

type EntityType = "post" | "category";

export default function AdminLocalizations() {
  const [entityType, setEntityType] = useState<EntityType>("post");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");

  // Queries to load entities
  const { data: postsResponse, isLoading: isLoadingPosts } = useGetPostsQuery({});
  const { data: categoriesResponse, isLoading: isLoadingCategories } = useGetCategoriesQuery();

  const posts = postsResponse?.data || [];
  const categories = categoriesResponse?.data || [];

  const entitiesList = entityType === "post" ? posts : categories;

  // Set first entity as selected by default when type or lists load
  useEffect(() => {
    if (entitiesList.length > 0) {
      // Keep selected if exists in list, otherwise select first
      const exists = entitiesList.some((e) => e.id === selectedEntityId);
      if (!exists) {
        setSelectedEntityId(entitiesList[0].id);
      }
    } else {
      setSelectedEntityId("");
    }
  }, [entityType, postsResponse, categoriesResponse]);

  // Form translation state
  const [ruTitle, setRuTitle] = useState("");
  const [ruDescription, setRuDescription] = useState("");
  const [enTitle, setEnTitle] = useState("");
  const [enDescription, setEnDescription] = useState("");

  const [updatePost, { isLoading: isUpdatingPost }] = useUpdatePostMutation();
  const [updateCategory, { isLoading: isUpdatingCategory }] = useUpdateCategoryMutation();
  const isSaving = isUpdatingPost || isUpdatingCategory;
  const isLoadingLocs = false; // Directly read from pre-loaded entities, no additional loading needed

  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync loaded entity values directly to form state
  useEffect(() => {
    setRuTitle("");
    setRuDescription("");
    setEnTitle("");
    setEnDescription("");
    setSaveStatus(null);

    if (selectedEntityId) {
      const entity = entitiesList.find((e) => e.id === selectedEntityId);
      if (entity) {
        const rawTitle = entity.title;
        const rawDesc = entity.description;

        setRuTitle(
          typeof rawTitle === "string"
            ? rawTitle
            : rawTitle?.ru || ""
        );
        setRuDescription(
          typeof rawDesc === "string"
            ? rawDesc
            : rawDesc?.ru || ""
        );
        setEnTitle(
          typeof rawTitle === "string"
            ? ""
            : rawTitle?.en || ""
        );
        setEnDescription(
          typeof rawDesc === "string"
            ? ""
            : rawDesc?.en || ""
        );
      }
    }
  }, [selectedEntityId, entityType, postsResponse, categoriesResponse]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntityId) return;

    setSaveStatus(null);
    try {
      if (entityType === "post") {
        await updatePost({
          id: selectedEntityId,
          title: { ru: ruTitle, en: enTitle },
          description: { ru: ruDescription, en: enDescription },
        }).unwrap();
      } else {
        const selectedEntity = entitiesList.find((e) => e.id === selectedEntityId) as any;
        if (!selectedEntity) return;

        await updateCategory({
          id: selectedEntityId,
          title: { ru: ruTitle, en: enTitle },
          description: { ru: ruDescription, en: enDescription },
          color: selectedEntity.colorId,
          parentId: selectedEntity.parentId,
          collectionId: selectedEntity.collectionId,
          tags: selectedEntity.tagsIds,
          slug: selectedEntity.slug,
        }).unwrap();
      }

      setSaveStatus({ type: "success", message: "Translations updated successfully!" });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      console.error("Failed to save translations", err);
      setSaveStatus({ type: "error", message: "Failed to save translations." });
    }
  };

  const selectedEntity = entitiesList.find((e) => e.id === selectedEntityId);
  const isTranslated = ruTitle.trim() !== "" && enTitle.trim() !== "";

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Languages className="text-primary" size={24} />
          Translation & Localization Manager
        </h1>
        <p className="text-sm text-muted-foreground">
          Translate project titles and descriptions into multiple languages independently of post creation.
        </p>
      </div>

      {/* Select Entity Controls */}
      <div className="bg-card rounded-xl border border-border/40 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Entity Type
            </label>
            <div className="flex bg-secondary rounded-lg p-0.5 border border-border/40">
              <button
                type="button"
                onClick={() => setEntityType("post")}
                className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  entityType === "post" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Projects
              </button>
              <button
                type="button"
                onClick={() => setEntityType("category")}
                className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  entityType === "category" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Categories
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select Item
            </label>
            {isLoadingPosts || isLoadingCategories ? (
              <div className="flex items-center h-10 px-3 bg-secondary rounded-lg border border-border/40 text-xs text-muted-foreground">
                <Loader2 className="animate-spin mr-2" size={14} /> Loading list...
              </div>
            ) : (
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full h-10 px-3 py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {entitiesList.length === 0 ? (
                  <option value="">No items found</option>
                ) : (
                  entitiesList.map((item) => {
                    const itemTitle = typeof item.title === "string" ? item.title : item.title?.ru || "";
                    return (
                      <option key={item.id} value={item.id}>
                        {itemTitle}
                      </option>
                    );
                  })
                )}
              </select>
            )}
          </div>
        </div>

        {selectedEntityId && (
          <div className="flex items-center gap-2 text-xs font-medium border-t pt-3">
            <span className="text-muted-foreground">Status:</span>
            {isLoadingLocs ? (
              <span className="text-muted-foreground flex items-center gap-1">
                <Loader2 className="animate-spin" size={12} /> Checking translation status...
              </span>
            ) : isTranslated ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={14} /> Fully Translated (RU/EN)
              </span>
            ) : (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertCircle size={14} /> Missing English Translation
              </span>
            )}
          </div>
        )}
      </div>

      {/* Translation Forms Grid */}
      {selectedEntityId && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Russian Column */}
            <div className="bg-card rounded-xl border border-border/40 p-6 shadow-sm space-y-4 relative">
              <div className="absolute top-4 right-4 bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase">
                RU
              </div>
              <h3 className="font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                Russian Translation
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Title / Name (RU)
                </label>
                <input
                  type="text"
                  value={ruTitle}
                  onChange={(e) => setRuTitle(e.target.value)}
                  placeholder="Название на русском..."
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Description (RU)
                </label>
                <textarea
                  value={ruDescription}
                  onChange={(e) => setRuDescription(e.target.value)}
                  placeholder="Описание на русском..."
                  rows={6}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* English Column */}
            <div className="bg-card rounded-xl border border-border/40 p-6 shadow-sm space-y-4 relative">
              <div className="absolute top-4 right-4 bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase">
                EN
              </div>
              <h3 className="font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                English Translation
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Title / Name (EN)
                </label>
                <input
                  type="text"
                  value={enTitle}
                  onChange={(e) => setEnTitle(e.target.value)}
                  placeholder="Title in English..."
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Description (EN)
                </label>
                <textarea
                  value={enDescription}
                  onChange={(e) => setEnDescription(e.target.value)}
                  placeholder="Description in English..."
                  rows={6}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between bg-card rounded-xl border border-border/40 px-6 py-4 shadow-sm">
            <div>
              {saveStatus && (
                <div
                  className={`text-xs font-semibold ${
                    saveStatus.type === "success" ? "text-emerald-600 animate-pulse" : "text-destructive"
                  }`}
                >
                  {saveStatus.message}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving || isLoadingLocs}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Translations
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
