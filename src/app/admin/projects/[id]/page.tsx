"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Save, Loader2, Image as ImageIcon, Move, Archive as ArchiveIcon, Send, Calendar as CalendarIcon } from "lucide-react";
import Link from "next/link";
import {
  useCreatePostMutation,
  useUpdatePostMutation,
  useGetPostByIdQuery,
  useGetCategoriesQuery,
  useGetTagsQuery,
  useCreateTagMutation,
  useGetMediaQuery,
  useGetCollectionsQuery,
} from "@/store/api";
import ImageCropModal from "@/components/shared/ImageCropModal";
import MediaPickerModal from "@/components/shared/MediaPickerModal";
import Combobox from "@/components/ui/combobox";
import { useTranslation } from "@/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { postSchema } from "@/common/validation/schemas";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { SortableMediaGrid } from "@/components/shared/SortableMediaGrid";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SelectedMedia {
  mediaId: string;
  url: string;
  position?: { x: number; y: number; zoom: number };
}

interface ProjectFormPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectFormPage({ params }: ProjectFormPageProps) {
  const { t, loc, locale } = useTranslation();
  const router = useRouter();
  const { id } = use(params);
  const isEditMode = id !== "new";
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Mutations & Queries
  const [createPost, { isLoading: isCreating }] = useCreatePostMutation();
  const [updatePost, { isLoading: isUpdating }] = useUpdatePostMutation();
  const { data: postResponse, isLoading: isPostLoading } = useGetPostByIdQuery(id, {
    skip: !isEditMode,
  });
  const { data: categoriesResponse } = useGetCategoriesQuery();
  const { data: tagsResponse } = useGetTagsQuery();
  const { data: collectionsResponse } = useGetCollectionsQuery();
  const [createTag] = useCreateTagMutation();

  const categories = categoriesResponse?.data || [];
  const allTags = tagsResponse?.data || [];
  const collections = collectionsResponse?.data || [];
  const { data: mediaResponse } = useGetMediaQuery();
  const mediaList = mediaResponse?.data || [];

  // Form State
  const defaultValues = {
    title: { ru: "", en: "" },
    description: { ru: "", en: "" },
    collectionId: undefined as any,
    categoryId: undefined as any,
    inStock: true,
    status: "Published" as any,
    tagsIds: [],
    media: [],
    posterId: undefined as any,
    createdAt: undefined as any,
  };

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema) as any,
    defaultValues,
    mode: "onChange"
  });

  const [selectedImages, setSelectedImages] = useState<SelectedMedia[]>([]);
  const [coverImage, setCoverImage] = useState(""); // mediaId of cover
  const [coverPosition, setCoverPosition] = useState<{ x: number; y: number; zoom: number } | null>(null);
  
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [activeCropMediaId, setActiveCropMediaId] = useState<string | null>(null);

  const handleCreateTag = async (name: string) => {
    try {
      const res = await createTag({
        name: { [locale]: name },
      }).unwrap();
      return res.data.id;
    } catch (err) {
      console.error("Failed to create tag dynamically", err);
      return "";
    }
  };

  // Sync complex states to RHF
  useEffect(() => {
    form.setValue("posterId", coverImage || undefined as any, { shouldValidate: true });
  }, [coverImage, form]);

  useEffect(() => {
    form.setValue(
      "media",
      selectedImages.map((img, i) => ({
        order: i + 1,
        mediaId: img.mediaId,
        position: img.position || undefined,
      })),
      { shouldValidate: true }
    );
  }, [selectedImages, form]);

  // Populate form if in Edit Mode
  useEffect(() => {
    if (isEditMode && postResponse?.data) {
      const post = postResponse.data;
      
      const cat = typeof post.category !== "string" ? post.category?.id || "" : post.category;
      const col = typeof post.collection !== "string" ? post.collection?.id || "" : post.collection;
      
      form.reset({
        title: typeof post.title === "string" ? { ru: post.title, en: "" } : { ru: post.title?.ru || "", en: post.title?.en || "" },
        description: typeof post.description === "string" ? { ru: post.description, en: "" } : { ru: post.description?.ru || "", en: post.description?.en || "" },
        categoryId: cat,
        collectionId: col || post.collectionId || "",
        inStock: post.inStock,
        status: post.status,
        tagsIds: post.tags ? post.tags.map((t: any) => typeof t === "string" ? t : t.id) : [],
        posterId: post.poster ? (typeof post.poster === "string" ? post.poster : post.poster.id) : undefined as any,
        createdAt: post.createdAt ? new Date(post.createdAt).toISOString().slice(0, 16) : undefined,
        media: post.media ? post.media.map((m: any, i: number) => ({
          order: i + 1,
          mediaId: typeof m.media === "string" ? m.media : m.media.id,
          position: m.position || undefined,
        })) : []
      });
      
      const images: SelectedMedia[] = post.media.map((m: any) => ({
        mediaId: typeof m.media === "string" ? m.media : m.media.id,
        url: typeof m.media === "string" ? "" : m.media.originalUrl,
        position: m.position,
      }));
      setSelectedImages(images);
      
      if (post.poster) {
        setCoverImage(typeof post.poster === "string" ? post.poster : post.poster.id);
        if (post.poster.position) {
          setCoverPosition(post.poster.position as any);
        }
      }
    }
  }, [isEditMode, postResponse, form]);

  // Auto-select defaults when only one option exists (for creation mode)
  useEffect(() => {
    if (!isEditMode) {
      const currentCollectionId = form.getValues("collectionId");
      const currentCategoryId = form.getValues("categoryId");

      if (!currentCollectionId && collections.length === 1) {
        form.setValue("collectionId", collections[0].id, { shouldValidate: true });
      }
      if (!currentCategoryId && categories.length === 1) {
        const defaultCat = categories[0];
        form.setValue("categoryId", defaultCat.id, { shouldValidate: true });
        if (defaultCat.tagsIds && defaultCat.tagsIds.length > 0) {
          form.setValue("tagsIds", defaultCat.tagsIds, { shouldValidate: true });
        }
      }
    }
  }, [isEditMode, collections, categories, form]);

  const handleMediaSelect = (mediaArray: { mediaId: string; url: string }[]) => {
    const newSelected = mediaArray.map(m => {
      const existing = selectedImages.find(s => s.mediaId === m.mediaId);
      return existing ? existing : { ...m };
    });
    setSelectedImages(newSelected);
    setIsMediaPickerOpen(false);
    
    if (newSelected.length > 0 && !coverImage) {
      setCoverImage(newSelected[0].mediaId);
    } else if (newSelected.length === 0) {
      setCoverImage("");
      setCoverPosition(null);
    }
  };

  const handleSaveCrop = (pos: { x: number; y: number; zoom: number }) => {
    if (activeCropMediaId === "cover") {
      setCoverPosition(pos);
      setSelectedImages(prev => prev.map(m => 
        m.mediaId === coverImage ? { ...m, position: pos } : m
      ));
    } else if (activeCropMediaId) {
      setSelectedImages(prev => prev.map(m => 
        m.mediaId === activeCropMediaId ? { ...m, position: pos } : m
      ));
      if (activeCropMediaId === coverImage) {
        setCoverPosition(pos);
      }
    }
    setActiveCropMediaId(null);
  };

  const onSubmit = async (values: z.infer<typeof postSchema>) => {
    try {
      let postId = id;
      if (isEditMode) {
        const existingTitle = postResponse?.data?.title && typeof postResponse.data.title === "object" ? postResponse.data.title : {};
        const existingDesc = postResponse?.data?.description && typeof postResponse.data.description === "object" ? postResponse.data.description : {};

        await updatePost({
          id,
          ...values,
          title: { ...existingTitle, ...values.title },
          description: { ...existingDesc, ...values.description },
        }).unwrap();
      } else {
        const res = await createPost(values).unwrap();
        postId = res.data?.id;
      }

      if (values.status === "Draft") {
        if (!isEditMode && postId) {
          router.replace(`/admin/projects/${postId}`);
        }
      } else {
        router.push("/admin/dashboard");
      }
    } catch (err: any) {
      if (err?.data?.error?.details) {
        err.data.error.details.forEach((detail: any) => {
          form.setError(detail.field as any, { type: "server", message: detail.message });
        });
      }
      console.error("Failed to save project", err);
    }
  };

  if (isEditMode && isPostLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  const isSaving = isCreating || isUpdating;

  // Options converters for Combobox
  const collectionOptions = collections.map((col) => ({
    value: col.id,
    label: typeof col.title === "string" ? col.title : col.title?.ru || col.title?.en || "",
  }));

  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: typeof cat.title === "string" ? cat.title : cat.title?.ru || "",
  }));

  const currentCategoryId = form.watch("categoryId");
  const activeCategory = categories.find((cat) => cat.id === currentCategoryId);

  const tagOptions = [...allTags]
    .sort((a, b) => {
      const aMatches = activeCategory?.tagsIds?.includes(a.id) ? 1 : 0;
      const bMatches = activeCategory?.tagsIds?.includes(b.id) ? 1 : 0;
      if (aMatches !== bMatches) return bMatches - aMatches;
      const aTitle = loc(a.name);
      const bTitle = loc(b.name);
      return aTitle.localeCompare(bTitle);
    })
    .map((tag) => {
      const isStarred = activeCategory?.tagsIds?.includes(tag.id);
      const tagTitle = loc(tag.name);
      return {
        value: tag.id,
        label: isStarred ? `${tagTitle} (★)` : tagTitle,
      };
    });

  const currentTitle = form.watch("title");
  const hasAnyTitle = currentTitle && Object.values(currentTitle).some((val) => typeof val === "string" && val.trim() !== "");

  const canPublish = !!(
    hasAnyTitle &&
    form.watch("collectionId") &&
    form.watch("categoryId") &&
    form.watch("posterId")
  );

  const handleActionClick = (status: "Draft" | "Published" | "Archived") => {
    form.setValue("status", status);
    form.handleSubmit(onSubmit)();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="p-1.5 rounded-lg border border-border bg-transparent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {isEditMode ? t("edit_project") : t("create_project")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEditMode ? t("edit_project_subtitle") : t("create_project_subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="bg-card rounded-xl border border-border/40 p-6 space-y-4 shadow-sm">
            
            {/* Title */}
            <FormField
              control={form.control}
              name={`title.${locale}` as any}
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                    {t("title")}
                  </FormLabel>
                  <FormControl>
                    <input
                      {...field}
                      type="text"
                      placeholder={t("placeholder_project_title")}
                      className={`w-full px-4 py-2.5 rounded-lg border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${form.formState.errors.title ? "border-destructive text-destructive focus:border-destructive focus:ring-destructive/20" : "border-border"}`}
                    />
                  </FormControl>
                  <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                </FormItem>
              )}
            />

            {/* Collection */}
            <FormField
              control={form.control}
              name="collectionId"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                    {t("collection")}
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      options={collectionOptions}
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder={t("placeholder_select_collection")}
                      searchPlaceholder={t("placeholder_search_collections")}
                    />
                  </FormControl>
                  <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                    {t("category")}
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      options={categoryOptions}
                      value={field.value || ""}
                      onChange={(val) => {
                        const oldCat = categories.find((cat) => cat.id === field.value);
                        const oldTags = oldCat?.tagsIds || [];

                        field.onChange(val);

                        const newCat = categories.find((cat) => cat.id === val);
                        const newTags = newCat?.tagsIds || [];

                        const prevTags = form.getValues("tagsIds") || [];
                        const filtered = prevTags.filter((tId: string) => !oldTags.includes(tId));
                        form.setValue("tagsIds", Array.from(new Set([...filtered, ...newTags])), { shouldValidate: true });
                      }}
                      placeholder={t("placeholder_select_category")}
                      searchPlaceholder={t("placeholder_search_categories")}
                    />
                  </FormControl>
                  <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name={`description.${locale}` as any}
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                    {t("description")}
                  </FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      placeholder={t("placeholder_project_desc")}
                      rows={4}
                      className={`w-full px-4 py-2.5 rounded-lg border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${form.formState.errors.description ? "border-destructive text-destructive focus:border-destructive focus:ring-destructive/20" : "border-border"}`}
                    />
                  </FormControl>
                  <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                </FormItem>
              )}
            />

            {/* Tags Combobox */}
            <FormField
              control={form.control}
              name="tagsIds"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                    {t("tags")}
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      options={tagOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t("placeholder_select_tags")}
                      searchPlaceholder={t("placeholder_search_or_type_tag")}
                      allowCreate
                      createLabel={t("add_new_tag_prompt")}
                      multiple
                      onCreate={handleCreateTag}
                    />
                  </FormControl>
                  <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                </FormItem>
              )}
            />

            {/* Stock Row and Date */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="inStock"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                      {t("availability")}
                    </FormLabel>
                    <div className="flex items-center gap-2 min-h-11">
                      <FormControl>
                        <Checkbox
                          id="inStockCheckbox"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="rounded-[6px] border-border/80 w-5 h-5 cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </FormControl>
                      <label htmlFor="inStockCheckbox" className="text-sm font-medium text-muted-foreground cursor-pointer select-none">
                        {t("in_stock")}
                      </label>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="createdAt"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                      {t("creation_date") === "creation_date" ? "Дата публикации" : t("creation_date")}
                    </FormLabel>
                    <FormControl>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border bg-transparent cursor-pointer text-sm transition-all hover:bg-muted/50 ${form.formState.errors.createdAt ? "border-destructive text-destructive" : "border-border hover:border-border/80"}`}
                          >
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                              <CalendarIcon size={16} />
                            </div>
                            <span className={field.value ? "text-foreground font-medium" : "text-muted-foreground"}>
                              {field.value 
                                ? new Date(field.value).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) 
                                : (locale === 'ru' ? "Выберите дату..." : "Select date...")}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4 rounded-2xl border-border/60 bg-card shadow-xl admin-area font-sans" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? date.toISOString() : undefined)}
                          />
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                  </FormItem>
                )}
              />
            </div>
          </div>

        {/* Media Selector with crop positioning */}
        <div className="bg-card rounded-xl border border-border/40 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <ImageIcon size={16} />
              <span>{t("gallery_and_media")}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMediaPickerOpen(true)}
              className="text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              {t("add_media")}
            </button>
          </div>

          {selectedImages.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-border rounded-xl">
              <p className="text-sm text-muted-foreground">{t("no_media_selected")}</p>
            </div>
          ) : (
            <SortableMediaGrid
              items={selectedImages}
              mediaList={mediaList}
              coverImage={coverImage}
              onReorder={setSelectedImages}
              onSetCover={(id, position) => {
                setCoverImage(id);
                setCoverPosition(position || null);
              }}
              onCrop={(id) => setActiveCropMediaId(id)}
              onRemove={(id) => {
                const newSelected = selectedImages.filter((img) => img.mediaId !== id);
                setSelectedImages(newSelected);
                if (coverImage === id) {
                  setCoverImage(newSelected.length > 0 ? newSelected[0].mediaId : "");
                  setCoverPosition(newSelected.length > 0 && newSelected[0].position ? newSelected[0].position : null);
                }
              }}
            />
          )}


          {/* Error Message for Poster */}
          {form.formState.errors.posterId && (
            <div className="pt-2">
              <p className="text-[0.8rem] font-medium text-destructive">{t(form.formState.errors.posterId.message as string)}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => handleActionClick("Archived")}
              disabled={isSaving}
              className="p-2.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
              title={t("archive")}
            >
              <ArchiveIcon size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="px-5 py-2.5 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors cursor-pointer"
            >
              {t("cancel")}
            </Link>

            {postResponse?.data?.status !== "Published" && (
              <button
                type="button"
                onClick={() => handleActionClick("Draft")}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[#F9E4D3] text-[#904504] text-sm font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSaving && form.getValues("status") === "Draft" ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    {t("saving")}
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {t("save_draft") === "save_draft" ? "Сохранить" : t("save_draft")}
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleActionClick("Published")}
              disabled={!canPublish || isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {isSaving && form.getValues("status") === "Published" ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  {t("saving")}
                </>
              ) : (
                <>
                  <Send size={16} />
                  {postResponse?.data?.status === "Published" 
                    ? (t("update") === "update" ? "Обновить" : t("update"))
                    : (t("publish") === "publish" ? "Опубликовать" : t("publish"))}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      </Form>

      {/* Modals */}
      {activeCropMediaId && (
        <ImageCropModal
          media={
            mediaList.find(m => m.id === (activeCropMediaId === "cover" ? coverImage : activeCropMediaId))
          }
          imageUrl={
            activeCropMediaId === "cover" 
              ? selectedImages.find(m => m.mediaId === coverImage)?.url || "" 
              : selectedImages.find(m => m.mediaId === activeCropMediaId)?.url || ""
          }
          initialPosition={
            activeCropMediaId === "cover" 
              ? coverPosition || undefined 
              : selectedImages.find(m => m.mediaId === activeCropMediaId)?.position
          }
          onClose={() => setActiveCropMediaId(null)}
          onSave={handleSaveCrop}
        />
      )}

      {isMediaPickerOpen && (
        <MediaPickerModal
          selectedIds={selectedImages.map(img => img.mediaId)}
          onSelect={handleMediaSelect}
          onClose={() => setIsMediaPickerOpen(false)}
        />
      )}
    </div>
  );
}
