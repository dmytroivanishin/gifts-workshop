"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, ArrowLeft, Languages } from "lucide-react";
import {
  useGetPostByIdQuery,
  useGetCategoryByIdQuery,
  useGetTagByIdQuery,
  useGetCollectionByIdQuery,
  useGetSystemTextByIdQuery,
  useUpdatePostMutation,
  useUpdateCategoryMutation,
  useUpdateTagMutation,
  useUpdateCollectionMutation,
  useUpdateSystemTextMutation,
} from "@/store/api";
import { useTranslation } from "@/i18n";

interface PageProps {
  params: Promise<{ entityType: string; id: string }>;
}

export default function LocalizationDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { entityType, id } = resolvedParams;
  const router = useRouter();
  const { t, activeLanguages } = useTranslation();

  const isPost = entityType === "post";
  const isCategory = entityType === "category";
  const isTag = entityType === "tag";
  const isCollection = entityType === "collection";
  const isSystem = entityType === "system";

  const { data: postData, isLoading: isLoadingPost } = useGetPostByIdQuery(id, { skip: !isPost });
  const { data: categoryData, isLoading: isLoadingCategory } = useGetCategoryByIdQuery(id, { skip: !isCategory });
  const { data: tagData, isLoading: isLoadingTag } = useGetTagByIdQuery(id, { skip: !isTag });
  const { data: collectionData, isLoading: isLoadingCollection } = useGetCollectionByIdQuery(id, { skip: !isCollection });
  const { data: systemData, isLoading: isLoadingSystem } = useGetSystemTextByIdQuery(id, { skip: !isSystem });

  const [updatePost, { isLoading: isUpdatingPost }] = useUpdatePostMutation();
  const [updateCategory, { isLoading: isUpdatingCategory }] = useUpdateCategoryMutation();
  const [updateTag, { isLoading: isUpdatingTag }] = useUpdateTagMutation();
  const [updateCollection, { isLoading: isUpdatingCollection }] = useUpdateCollectionMutation();
  const [updateSystem, { isLoading: isUpdatingSystem }] = useUpdateSystemTextMutation();

  const isSaving = isUpdatingPost || isUpdatingCategory || isUpdatingTag || isUpdatingCollection || isUpdatingSystem;
  const isLoadingEntity = isLoadingPost || isLoadingCategory || isLoadingTag || isLoadingCollection || isLoadingSystem;

  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [titles, setTitles] = useState<Record<string, string>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});

  const entity = isPost ? postData?.data : isCategory ? categoryData?.data : isTag ? tagData?.data : isCollection ? collectionData?.data : systemData?.data;

  // Sync loaded entity values directly to form state
  useEffect(() => {
    if (entity) {
      if (isSystem) {
         // SystemText has 'content'
         const rawContent = (entity as any).content || {};
         const newTitles: Record<string, string> = {};
         activeLanguages.forEach(lang => {
           newTitles[lang] = rawContent[lang] || "";
         });
         setTitles(newTitles);
      } else {
         const rawTitle = (entity as any).title || (entity as any).name;
         const rawDesc = (entity as any).description || {};

         const newTitles: Record<string, string> = {};
         const newDescs: Record<string, string> = {};

         activeLanguages.forEach(lang => {
            newTitles[lang] = typeof rawTitle === "string" && lang === "ru" ? rawTitle : rawTitle?.[lang] || "";
            newDescs[lang] = typeof rawDesc === "string" && lang === "ru" ? rawDesc : rawDesc?.[lang] || "";
         });

         setTitles(newTitles);
         setDescriptions(newDescs);
      }
    }
  }, [entity, activeLanguages, isSystem]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);

    try {
      if (isSystem) {
        await updateSystem({ id, content: titles }).unwrap();
      } else if (isPost) {
        await updatePost({
          id,
          title: titles,
          description: descriptions,
        }).unwrap();
      } else if (isCategory) {
        const cat = entity as any;
        await updateCategory({
          id,
          title: titles,
          description: descriptions,
          color: cat.color,
          parentId: cat.parentId,
          collectionId: cat.collectionId,
          tagsIds: cat.tagsIds,
        }).unwrap();
      } else if (isTag) {
        await updateTag({
          id,
          title: titles, 
        }).unwrap();
      } else if (isCollection) {
        await updateCollection({
          id,
          title: titles,
          description: descriptions,
        }).unwrap();
      }

      setSaveStatus({ type: "success", message: t("translations_success") || "Saved successfully!" });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      console.error("Failed to save translations", err);
      setSaveStatus({ type: "error", message: t("translations_error") || "Error saving" });
    }
  };

  const updateField = (lang: string, field: "title" | "desc", val: string) => {
    if (field === "title") {
      setTitles(prev => ({ ...prev, [lang]: val }));
    } else {
      setDescriptions(prev => ({ ...prev, [lang]: val }));
    }
  };

  if (isLoadingEntity) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        {t("items_not_found") || "Entity not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/admin/localizations")}
          className="p-2 rounded-lg bg-card border border-border/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Back to list"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Languages className="text-primary" size={24} />
            {t("translations_title") || "Localizations"}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {entityType} - {id}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className={`grid grid-cols-1 md:grid-cols-${Math.min(activeLanguages.length, 3)} gap-6`}>
          {activeLanguages.map((lang) => (
            <div key={lang} className="bg-card rounded-xl border border-border/40 p-6 shadow-sm space-y-4 relative">
              <div className="absolute top-4 right-4 bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase">
                {lang}
              </div>
              <h3 className="font-bold text-sm text-foreground mb-2 flex items-center gap-2 uppercase">
                {lang} {isSystem ? "Translation" : ""}
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {isSystem ? "Content" : "Title"} ({lang})
                </label>
                <input
                  type="text"
                  value={titles[lang] || ""}
                  onChange={(e) => updateField(lang, "title", e.target.value)}
                  placeholder="..."
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-all"
                  required={lang === "ru" || lang === "en"} // require base languages usually
                />
              </div>

              {!isTag && !isSystem && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("description") || "Description"} ({lang})
                  </label>
                  <textarea
                    value={descriptions[lang] || ""}
                    onChange={(e) => updateField(lang, "desc", e.target.value)}
                    placeholder="..."
                    rows={6}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-all"
                  />
                </div>
              )}
            </div>
          ))}
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
            disabled={isSaving}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                {t("saving") || "Saving..."}
              </>
            ) : (
              <>
                <Save size={16} />
                {t("save") || "Save"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
