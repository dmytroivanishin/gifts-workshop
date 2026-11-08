"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, ArrowLeft } from "lucide-react";
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
  useCreateSystemTextMutation,
} from "@/store/api";
import { useTranslation } from "@/i18n";
import Combobox from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiMutationError, SystemText, PopulatedPost, PopulatedCategory, Tag, Collection, LocalizedText } from "@/types";

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
  const { data: systemData, isLoading: isLoadingSystem } = useGetSystemTextByIdQuery(id, { skip: !isSystem || id === "new" });

  const [updatePost, { isLoading: isUpdatingPost }] = useUpdatePostMutation();
  const [updateCategory, { isLoading: isUpdatingCategory }] = useUpdateCategoryMutation();
  const [updateTag, { isLoading: isUpdatingTag }] = useUpdateTagMutation();
  const [updateCollection, { isLoading: isUpdatingCollection }] = useUpdateCollectionMutation();
  const [updateSystem, { isLoading: isUpdatingSystem }] = useUpdateSystemTextMutation();
  const [createSystemText, { isLoading: isCreatingSystem }] = useCreateSystemTextMutation();

  const isSaving = isUpdatingPost || isUpdatingCategory || isUpdatingTag || isUpdatingCollection || isUpdatingSystem || isCreatingSystem;
  const isLoadingEntity = (isLoadingPost || isLoadingCategory || isLoadingTag || isLoadingCollection || isLoadingSystem) && id !== "new";

  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [titles, setTitles] = useState<Record<string, string>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [area, setArea] = useState<string>("admin");
  const [code, setCode] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const getFieldError = (field: string) => serverErrors[field] || serverErrors[`${field}.ru`] || serverErrors[`${field}.en`];

  const entity = isPost ? postData?.data : isCategory ? categoryData?.data : isTag ? tagData?.data : isCollection ? collectionData?.data : systemData?.data;

  // Sync loaded entity values directly to form state
  useEffect(() => {
    if (entity) {
      if (isSystem) {
         // SystemText has 'content'
         const systemEntity = entity as SystemText;
         const rawContent = systemEntity.content || {};
         const newTitles: Record<string, string> = {};
         activeLanguages.forEach(lang => {
           newTitles[lang] = rawContent[lang] || "";
         });
         setTitles(newTitles);
         setArea(systemEntity.area || "admin");
         setCode(systemEntity.code || "");
      } else {
         const namedEntity = entity as { title?: LocalizedText | string; name?: LocalizedText | string; description?: LocalizedText | string };
         const rawTitle = namedEntity.title || namedEntity.name;
         const rawDesc = namedEntity.description || {};

         const newTitles: Record<string, string> = {};
         const newDescs: Record<string, string> = {};

         activeLanguages.forEach(lang => {
            newTitles[lang] = typeof rawTitle === "string" && lang === "ru" ? rawTitle : (rawTitle as LocalizedText | undefined)?.[lang] || "";
            newDescs[lang] = typeof rawDesc === "string" && lang === "ru" ? rawDesc : (rawDesc as LocalizedText | undefined)?.[lang] || "";
         });

         setTitles(newTitles);
         setDescriptions(newDescs);
      }
    } else if (id === "new" && isSystem) {
       const newTitles: Record<string, string> = {};
       activeLanguages.forEach(lang => {
         newTitles[lang] = "";
       });
       setTitles(newTitles);
       setArea("admin");
       setCode("");
    }
  }, [entity, activeLanguages, isSystem, id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    setIsSubmitted(true);
    setServerErrors({});

    const defaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "ru";
    if (!titles[defaultLocale] || !titles[defaultLocale].trim()) return;

    try {
      if (isSystem) {
        if (id === "new") {
          const res = await createSystemText({ content: titles, area, code }).unwrap();
          setSaveStatus({ type: "success", message: t("translations_success") || "Saved successfully!" });
          setTimeout(() => router.push(`/admin/localizations/system/${res.data.id}`), 1000);
          return;
        } else {
          await updateSystem({ id, content: titles, area, code }).unwrap();
        }
      } else if (isPost) {
        const post = entity as PopulatedPost;
        await updatePost({
          id,
          title: titles,
          description: descriptions,
          inStock: post.inStock,
          status: post.status,
          collectionId: post.collectionId,
          categoryId: post.categoryId,
          tagsIds: post.tagsIds,
          posterId: post.posterId,
          media: post.media,
        }).unwrap();
      } else if (isCategory) {
        const cat = entity as PopulatedCategory;
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
        const tag = entity as Tag;
        await updateTag({
          id,
          name: titles,
          slug: tag.slug,
        }).unwrap();
      } else if (isCollection) {
        const coll = entity as Collection;
        await updateCollection({
          id,
          title: titles,
          description: descriptions,
          main: coll.main,
          slug: coll.slug,
        }).unwrap();
      }

      setSaveStatus({ type: "success", message: t("translations_success") || "Saved successfully!" });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: unknown) {
      const apiError = err as ApiMutationError;
      if (apiError?.data?.error?.details) {
        const newErrors: Record<string, string> = {};
        apiError.data.error.details.forEach((detail) => {
          if (detail.field) newErrors[detail.field] = detail.message;
        });
        setServerErrors(newErrors);
      }
      console.error("Failed to save translations", err);
      setSaveStatus({ type: "error", message: t("translations_error") || "Error saving" });
    }
  };

  const updateField = (lang: string, field: "title" | "desc", val: string) => {
    if (field === "title") {
      setTitles(prev => ({ ...prev, [lang]: val }));
      if (getFieldError(`title.${lang}`) || getFieldError("title")) {
        setServerErrors(prev => ({ ...prev, [`title.${lang}`]: "", title: "" }));
      }
    } else {
      setDescriptions(prev => ({ ...prev, [lang]: val }));
      if (getFieldError(`description.${lang}`) || getFieldError("description")) {
        setServerErrors(prev => ({ ...prev, [`description.${lang}`]: "", description: "" }));
      }
    }
  };

  if (isLoadingEntity) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!entity && id !== "new") {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {t("items_not_found") || "Entity not found"}
      </div>
    );
  }

  const entityTypeLabels: Record<string, string> = {
    post: t("posts"),
    category: t("categories"),
    tag: t("tags"),
    collection: t("collections"),
    system: t("system_texts"),
  };
  const entityTypeLabel = entityTypeLabels[entityType] ?? entityType;

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/admin/localizations")}
          className="p-2 rounded-lg bg-card border border-border text-subtle-foreground hover:text-foreground transition-colors cursor-pointer"
          title={t("back_to_list")}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("translations_title") || "Localizations"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {entityTypeLabel}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6" noValidate>
        {isSystem && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("system_text_settings") || "System Text Settings"}
              </h3>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("text_code_key") || "Text Code / Key"}
                </label>
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. save_button"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("visibility_area") || "Visibility Area"}
                </label>
                <Combobox
                  options={[
                    { value: "public", label: t("area_public") || "Public (Visible to everyone)" },
                    { value: "admin", label: t("area_admin") || "Admin (Visible only in admin panel)" },
                    { value: "shared", label: t("area_shared") || "Shared (Visible in both)" },
                  ]}
                  value={area}
                  onChange={(val) => setArea(val as string)}
                  clearable={false}
                  searchable={false}
                />
              </div>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 md:grid-cols-${Math.min(activeLanguages.length, 3)} gap-6`}>
          {activeLanguages.map((lang) => (
            <div key={lang} className="bg-card rounded-xl border border-border overflow-hidden h-fit">
              <div className="p-4 border-b border-border bg-muted/50">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {lang} {isSystem ? "Translation" : ""}
                </h3>
              </div>

              <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {isSystem ? (t("content_label") || "Content") : (t("title") || "Title")} ({lang})
                </label>
                  <Input
                    type="text"
                    value={titles[lang] || ""}
                    onChange={(e) => updateField(lang, "title", e.target.value)}
                    placeholder="..."
                    invalid={Boolean(((lang === (process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "ru")) && isSubmitted && (!titles[lang] || !titles[lang].trim())) || getFieldError(`title.${lang}`) || getFieldError("title"))}
                    required={lang === (process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "ru")}
                  />
                  {(((lang === (process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "ru")) && isSubmitted && (!titles[lang] || !titles[lang].trim())) || getFieldError(`title.${lang}`) || getFieldError("title")) && <p className="text-[0.8rem] font-medium text-destructive mt-1.5">{getFieldError(`title.${lang}`) || getFieldError("title") || t("VALIDATION_ERROR") || "This field is required"}</p>}
                </div>

              {!isTag && !isSystem && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("description") || "Description"} ({lang})
                  </label>
                  <Textarea
                    value={descriptions[lang] || ""}
                    onChange={(e) => updateField(lang, "desc", e.target.value)}
                    placeholder="..."
                    rows={6}
                    invalid={Boolean(getFieldError(`description.${lang}`) || getFieldError("description"))}
                  />
                  {(getFieldError(`description.${lang}`) || getFieldError("description")) && <p className="text-[0.8rem] font-medium text-destructive mt-1.5">{getFieldError(`description.${lang}`) || getFieldError("description")}</p>}
                </div>
              )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between">
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
            disabled={isSaving || !titles[process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "ru"] || !titles[process.env.NEXT_PUBLIC_DEFAULT_LOCALE || "ru"].trim() || Object.keys(serverErrors).length > 0}
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
