"use client";

import { addMissingTags, mergeTagsById } from "@/utils/tags";
import { hasLocalizedValue } from "@/utils/localization";
import { SelectedMedia, postToFormValues, postToSelectedImages, buildTagOptions } from "./postEditorMapping";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Save, Loader2, Archive as ArchiveIcon, Send, Calendar as CalendarIcon, ClipboardPaste, X } from "lucide-react";
import Link from "next/link";
import {
  useCreatePostMutation,
  useUpdatePostMutation,
  useGetPostByIdQuery,
  useGetCategoriesQuery,
  useCreateTagMutation,
  useGetMediaQuery,
  useGetCollectionsQuery,
} from "@/store/api";
import { useTagsList } from "@/hooks/useTagsList";
import ImageCropModal from "@/components/shared/ImageCropModal";
import MediaPickerModal from "@/components/shared/MediaPickerModal";
import { useMediaClipboard } from "@/hooks/useMediaClipboard";
import { resolvePaste } from "@/utils/mediaClipboard";
import { addNotification } from "@/store/slices/notificationSlice";
import { useDispatch } from "react-redux";
import Combobox from "@/components/ui/combobox";
import { Input, FIELD_BASE } from "@/components/ui/input";
import { cn } from "@/utils/cn";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { postSchema } from "@/common/validation/schemas";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { SortableMediaGrid } from "@/components/shared/SortableMediaGrid";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { ru, enUS, Locale } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApiMutationError, Tag } from "@/types";
import { BLOCK_HEADER_CLASS, BUTTON_M_SIZE } from "@/utils/designTokens";

const dateLocales: Record<string, Locale> = { ru, en: enUS };

interface PostFormPageProps {
  params: Promise<{ id: string }>;
}

export default function PostFormPage({ params }: PostFormPageProps) {
  const { t, loc, locale } = useTranslation();
  const router = useRouter();
  const { id } = use(params);
  const isEditMode = id !== "new";

  // Mutations & Queries
  const [createPost, { isLoading: isCreating }] = useCreatePostMutation();
  const [updatePost, { isLoading: isUpdating }] = useUpdatePostMutation();
  const { data: postResponse, isLoading: isPostLoading } = useGetPostByIdQuery(id, {
    skip: !isEditMode,
  });
  const { data: categoriesResponse } = useGetCategoriesQuery();
  const [tagSearch, setTagSearch] = useState("");
  const { tags: searchedTags, hasMore: hasMoreTags, loadMore: loadMoreTags } = useTagsList(tagSearch);
  // Tags that must always resolve to a real name in the Combobox even when they fall outside
  // the current search/page — the post's own existing tags (on load) and any tag created
  // on the fly (handleCreateTag) — since `searchedTags` only ever holds the current page.
  const [extraTags, setExtraTags] = useState<Tag[]>([]);
  const { data: collectionsResponse } = useGetCollectionsQuery();
  const [createTag] = useCreateTagMutation();

  const categories = categoriesResponse?.data || [];
  // Deliberately NOT merged with extraTags: this drives the dropdown's own visible option list
  // (the sort/star logic below included), which must stay exactly what the current search/page
  // actually matched — extraTags only resolves already-selected chips via `resolveLabel` below.
  const allTags = searchedTags;
  const collections = collectionsResponse?.data || [];
  const { data: mediaResponse } = useGetMediaQuery();
  const mediaList = mediaResponse?.data || [];
  const dispatch = useDispatch();
  const clipboard = useMediaClipboard();

  // Form State
  const defaultValues = {
    title: {},
    description: {},
    collectionId: undefined as any,
    categoryId: undefined as any,
    inStock: true,
    price: null as number | null,
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
      const response = await createTag({
        name: { [locale]: name },
      }).unwrap();
      setExtraTags((prev) => [...prev, response.data]);
      return response.data.id;
    } catch (error) {
      console.error("Failed to create tag dynamically", error);
      return "";
    }
  };

  // Opportunistically cache any currently-selected tag the moment it's visible in
  // `searchedTags` — without this, selecting a tag while the dropdown is unsearched and then
  // typing an unrelated search term would narrow `searchedTags` away from it, and its chip
  // would fall back to showing the raw id (resolveLabel only has what's in extraTags).
  const selectedTagIds = form.watch("tagsIds") || [];
  useEffect(() => {
    const toCache = searchedTags.filter((tag) => selectedTagIds.includes(tag.id));
    if (!toCache.length) return;
    setExtraTags((previous) => addMissingTags(previous, toCache));
  }, [searchedTags, selectedTagIds]);

  // Sync complex states to RHF
  useEffect(() => {
    form.setValue("posterId", coverImage || undefined as any, { shouldValidate: true });
  }, [coverImage, form]);

  useEffect(() => {
    form.setValue(
      "media",
      selectedImages.map((image, index) => ({
        order: index + 1,
        mediaId: image.mediaId,
        position: image.position || undefined,
      })),
      { shouldValidate: true }
    );
  }, [selectedImages, form]);

  // Populate form if in Edit Mode
  useEffect(() => {
    if (isEditMode && postResponse?.data) {
      const post = postResponse.data;

      form.reset(postToFormValues(post, locale));

      if (post.tags) {
        const fullTags = post.tags.filter((tagOrId: Tag | string): tagOrId is Tag => typeof tagOrId !== "string");
        setExtraTags((previous) => mergeTagsById(previous, fullTags));
      }

      setSelectedImages(postToSelectedImages(post));

      if (post.poster) {
        setCoverImage(typeof post.poster === "string" ? post.poster : post.poster.id);
        if ((post.poster as any).position) {
          setCoverPosition((post.poster as any).position as any);
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
    const newSelected = mediaArray.map(entry => {
      const existing = selectedImages.find(selected => selected.mediaId === entry.mediaId);
      return existing ? existing : { ...entry };
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

  // Pastes the media copied in the library: merges into the current gallery (never replaces it,
  // never adds a duplicate) and always empties the buffer afterwards, so a paste is one-shot and
  // nothing stays copied by accident. Media deleted since copying is skipped and reported.
  const handlePasteMedia = () => {
    if (!mediaResponse) return;
    const byId = new Map(mediaList.map((media) => [media.id, media]));
    const { toAdd, missing } = resolvePaste(
      clipboard.ids,
      new Set(byId.keys()),
      new Set(selectedImages.map((image) => image.mediaId))
    );

    if (toAdd.length > 0) {
      handleMediaSelect([
        ...selectedImages,
        ...toAdd.map((mediaId) => ({ mediaId, url: byId.get(mediaId)?.originalUrl || "" })),
      ]);
    }
    clipboard.clear();

    if (missing > 0) {
      dispatch(addNotification({ type: "warning", messageKey: "media_paste_skipped" }));
    } else if (toAdd.length > 0) {
      dispatch(addNotification({ type: "success", messageKey: "media_pasted" }));
    } else {
      dispatch(addNotification({ type: "info", messageKey: "media_paste_nothing_new" }));
    }
  };

  const handleSaveCrop = (position: { x: number; y: number; zoom: number }) => {
    if (activeCropMediaId === "cover") {
      setCoverPosition(position);
      setSelectedImages(prev => prev.map(image =>
        image.mediaId === coverImage ? { ...image, position: position } : image
      ));
    } else if (activeCropMediaId) {
      setSelectedImages(prev => prev.map(image =>
        image.mediaId === activeCropMediaId ? { ...image, position: position } : image
      ));
      if (activeCropMediaId === coverImage) {
        setCoverPosition(position);
      }
    }
    setActiveCropMediaId(null);
  };

  const onSubmit = async (values: z.infer<typeof postSchema>) => {
    try {
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
        await createPost(values).unwrap();
      }

      // A draft and a publish both return to the list.
      router.push("/admin/posts");
    } catch (error: unknown) {
      const apiError = error as ApiMutationError;
      if (apiError?.data?.error?.details) {
        apiError.data.error.details.forEach((detail) => {
          form.setError(detail.field as any, { type: "server", message: detail.message });
        });
      }
      console.error("Failed to save post", error);
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
  const collectionOptions = collections.map((collection) => ({
    value: collection.id,
    label: loc(collection.title),
  }));

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: loc(category.title),
  }));

  const currentCategoryId = form.watch("categoryId");
  const activeCategory = categories.find((category) => category.id === currentCategoryId);

  const tagOptions = buildTagOptions(allTags, activeCategory, loc);

  const currentTitle = form.watch("title");
  const hasAnyTitle = hasLocalizedValue(currentTitle);

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
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/posts"
            className="p-1.5 rounded-lg border border-border bg-transparent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-[22px] lg:text-2xl font-bold tracking-tight text-foreground">
              {isEditMode ? t("edit_post") : t("create_post")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEditMode ? t("edit_post_subtitle") : t("create_post_subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">

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
                    <Input
                      {...field}
                      value={field.value || ""}
                      type="text"
                      placeholder={t("placeholder_post_title")}
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-medium text-destructive" />
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
                  <FormMessage className="text-xs font-medium text-destructive" />
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
                      onChange={(value) => {
                        const oldCat = categories.find((category) => category.id === field.value);
                        const oldTags = oldCat?.tagsIds || [];

                        field.onChange(value);

                        const newCat = categories.find((category) => category.id === value);
                        const newTags = newCat?.tagsIds || [];

                        const prevTags = form.getValues("tagsIds") || [];
                        const filtered = prevTags.filter((tId: string) => !oldTags.includes(tId));
                        form.setValue("tagsIds", Array.from(new Set([...filtered, ...newTags])), { shouldValidate: true });

                        // The category's own suggested tags are full Tag objects here (PopulatedCategory),
                        // independent of whatever page/search the tags Combobox currently has loaded —
                        // cache them so a newly auto-added tag's chip always resolves a real label.
                        if (newCat?.tags?.length) {
                          setExtraTags((previous) => mergeTagsById(previous, newCat.tags));
                        }
                      }}
                      placeholder={t("placeholder_select_category")}
                      searchPlaceholder={t("placeholder_search_categories")}
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-medium text-destructive" />
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
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder={t("placeholder_post_desc")}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-medium text-destructive" />
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
                      serverSearch
                      onSearchChange={setTagSearch}
                      onEndReached={hasMoreTags ? loadMoreTags : undefined}
                      resolveLabel={(id) => {
                        const tag = extraTags.find((extraTag) => extraTag.id === id);
                        return tag ? loc(tag.name) : undefined;
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-xs font-medium text-destructive" />
                </FormItem>
              )}
            />

            {/* Stock Row and Date */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Stock and price share one row: both columns start at the top, so the headers
                  ("НАЛИЧИЕ", "ЦЕНА") and the controls (checkbox, number input) line up. */}
              <div className="flex items-start justify-between gap-4">
                <FormField
                  control={form.control}
                  name="inStock"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-1.5">
                      <FormLabel className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                        {t("availability")}
                      </FormLabel>
                      <div className="flex items-center gap-2 h-9 sm:h-10">
                        <FormControl>
                          <Checkbox
                            id="inStockCheckbox"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <label htmlFor="inStockCheckbox" className="text-[13px] font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap">
                          {t("in_stock")}
                        </label>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem className="ml-auto flex flex-col gap-1.5">
                      <FormLabel className={BLOCK_HEADER_CLASS}>
                        {t("price")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          className="w-24"
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value === "" ? null : Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage className="text-xs font-medium text-destructive" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="createdAt"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                      {t("creation_date") === "creation_date" ? "Дата публикации" : t("creation_date")}
                    </FormLabel>
                    <FormControl>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-invalid={!!form.formState.errors.createdAt}
                            className={cn(FIELD_BASE, "flex h-9 sm:h-10 items-center gap-2.5 px-3.5 text-left cursor-pointer")}
                          >
                            <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
                            <span className={field.value ? "text-foreground" : "text-muted-foreground"}>
                              {field.value
                                ? new Date(field.value).toLocaleString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
                                : t("select_date")}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-4 rounded-xl border-border bg-card shadow-lg admin-area font-sans" align="start">
                          <Calendar
                            mode="single"
                            locale={dateLocales[locale] || enUS}
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => field.onChange(date ? date.toISOString() : undefined)}
                          />
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage className="text-xs font-medium text-destructive" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Media Selector with crop positioning */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-end border-b pb-2">
              <div className="flex items-center gap-2">
                {clipboard.ids.length > 0 && (
                  <div
                    data-test-id="paste-media-group"
                    className="flex items-center rounded-lg bg-secondary text-subtle-foreground"
                  >
                    <button
                      type="button"
                      data-test-id="paste-media-button"
                      title={t("media_paste")}
                      aria-label={t("media_paste")}
                      disabled={!mediaResponse}
                      onClick={handlePasteMedia}
                      className="flex items-center gap-1.5 rounded-l-lg px-3 py-1.5 text-xs font-semibold hover:text-foreground disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <ClipboardPaste size={14} />
                      <span data-test-id="paste-media-count">{clipboard.ids.length}</span>
                    </button>
                    <button
                      type="button"
                      data-test-id="paste-media-clear"
                      title={t("media_clipboard_clear")}
                      aria-label={t("media_clipboard_clear")}
                      onClick={clipboard.clear}
                      className="rounded-r-lg px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsMediaPickerOpen(true)}
                  className={cn(BUTTON_M_SIZE, "inline-flex items-center font-medium whitespace-nowrap bg-secondary text-subtle-foreground hover:text-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer")}
                >
                  {t("add_media")}
                </button>
              </div>
            </div>

            {selectedImages.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-border rounded-xl">
                <p className="text-xs text-muted-foreground">{t("no_media_selected")}</p>
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
                  const newSelected = selectedImages.filter((image) => image.mediaId !== id);
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
                <p className="text-xs font-medium text-destructive">{t(form.formState.errors.posterId.message as string)}</p>
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
                className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-lg bg-secondary text-subtle-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                title={t("archive")}
              >
                <ArchiveIcon size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {postResponse?.data?.status !== "Published" && (
                <button
                  type="button"
                  onClick={() => handleActionClick("Draft")}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 h-9 px-4 sm:h-10 sm:px-5 bg-[#F9E4D3] text-[#904504] text-[13px] sm:text-sm font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSaving && form.getValues("status") === "Draft" ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleActionClick("Published")}
                disabled={!canPublish || isSaving}
                data-test-id="post-publish-button"
                className="flex items-center gap-1.5 h-9 px-4 sm:h-10 sm:px-5 bg-primary text-primary-foreground text-[13px] sm:text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {isSaving && form.getValues("status") === "Published" ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Send size={16} />
                )}
                {postResponse?.data?.status === "Published"
                  ? (t("update") === "update" ? "Обновить" : t("update"))
                  : (t("publish") === "publish" ? "Опубликовать" : t("publish"))}
              </button>
            </div>
          </div>
        </form>
      </Form>

      {/* Modals */}
      {activeCropMediaId && (
        <ImageCropModal
          media={
            mediaList.find(media => media.id === (activeCropMediaId === "cover" ? coverImage : activeCropMediaId))
          }
          imageUrl={
            activeCropMediaId === "cover"
              ? selectedImages.find(image => image.mediaId === coverImage)?.url || ""
              : selectedImages.find(image => image.mediaId === activeCropMediaId)?.url || ""
          }
          initialPosition={
            activeCropMediaId === "cover"
              ? coverPosition || undefined
              : selectedImages.find(image => image.mediaId === activeCropMediaId)?.position
          }
          onClose={() => setActiveCropMediaId(null)}
          onSave={handleSaveCrop}
        />
      )}

      {isMediaPickerOpen && (
        <MediaPickerModal
          selectedIds={selectedImages.map(image => image.mediaId)}
          onSelect={handleMediaSelect}
          onClose={() => setIsMediaPickerOpen(false)}
        />
      )}
    </div>
  );
}
