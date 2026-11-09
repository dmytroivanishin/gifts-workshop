"use client";

import { addMissingTags, mergeTagsById } from "@/utils/tags";
import { useState, useEffect } from "react";
import { Plus, Edit, Save, X, Loader2, Trash2 } from "lucide-react";
import {
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useCreateTagMutation,
  useGetCollectionsQuery,
  useGetColorsQuery,
  useCreateColorMutation,
  useUpdateColorMutation,
  useDeleteCategoryMutation,
  useReorderCategoriesMutation
} from "@/store/api";
import { useTagsList } from "@/hooks/useTagsList";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import Combobox from "@/components/ui/combobox";
import { RowAction, RowActions } from "@/components/shared/RowAction";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { Textarea } from "@/components/ui/textarea";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { useTranslation } from "@/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { categorySchema } from "@/common/validation/schemas";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { SortableCategoryGroup } from "@/components/shared/SortableCategoryTree";
import { getLocalizedField } from "@/utils/localization";
import { ApiMutationError, PopulatedCategory, Tag } from "@/types";

export default function AdminCategories() {
  const { t, loc, locale } = useTranslation();

  const { data: categoriesResponse, isLoading } = useGetCategoriesQuery();
  // One form serves both adding and editing a category, so there is one tags Combobox and one
  // search state for it.
  const [newTagSearch, setNewTagSearch] = useState("");
  const { tags: newSearchedTags, hasMore: hasMoreNewTags, loadMore: loadMoreNewTags } = useTagsList(newTagSearch);
  // Tags that must always resolve to a real name in the Combobox even when outside the current
  // search/page — a category's own already-assigned tags (on edit) and any tag created on the
  // fly — since the searched-tags lists above only ever hold their own current page.
  const [extraTags, setExtraTags] = useState<Tag[]>([]);
  const { data: collectionsResponse } = useGetCollectionsQuery();
  const { data: colorsResponse } = useGetColorsQuery();
  const [saveCategory, { isLoading: isSaving }] = useCreateCategoryMutation();
  const [reorderCategories] = useReorderCategoriesMutation();
  const [deleteCategory] = useDeleteCategoryMutation();
  const [createTag] = useCreateTagMutation();
  const [createColor] = useCreateColorMutation();
  const [updateColor] = useUpdateColorMutation();

  const categories = categoriesResponse?.data || [];
  const colorsList = colorsResponse?.data || [];
  const newTagOptions = newSearchedTags.map((tag) => ({
    value: tag.id,
    label: loc(tag.name)
  }));
  const resolveTagLabel = (id: string) => {
    const tag = extraTags.find((extraTag) => extraTag.id === id);
    return tag ? loc(tag.name) : undefined;
  };

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const {
    isOpen: isDeleteOpen,
    targetId: deleteTargetId,
    handleDeleteClick,
    handleConfirmDelete,
    handleClose: handleDeleteClose,
  } = useDeleteConfirm(deleteCategory, {
    onSuccess: () => {
      if (isEditing === deleteTargetId) {
        resetForm();
      }
    },
    onError: (error) => console.error("Failed to delete category", error),
    closeOnError: true,
  });

  // Form State
  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema) as any,
    defaultValues: {
      title: {},
      description: {},
      collectionId: "", 
      parentId: null,
      tagsIds: [],
      color: { id: "", color: "" }
    },
    mode: "onChange"
  });

  const [color, setColor] = useState("");
  const [selectedColorId, setSelectedColorId] = useState("");
  const [sessionColorId, setSessionColorId] = useState("");
  const [isCreatingColorPending, setIsCreatingColorPending] = useState(false);

  const collections = collectionsResponse?.data || [];

  // Edit State
  const [activeCategoryObj, setActiveCategoryObj] = useState<PopulatedCategory | null>(null);

  // Opportunistically cache any currently-selected tag the moment it's visible in its
  // Combobox's own searched-tags page — without this, selecting a tag while unsearched and
  // then typing an unrelated search term would narrow the options away from it, and its chip
  // would fall back to showing the raw id (resolveTagLabel only has what's in extraTags).
  const newSelectedTagIds: string[] = form.watch("tagsIds") || [];
  const cacheSelectedTags = (searched: Tag[], selectedIds: string[]) => {
    const toCache = searched.filter((tag) => selectedIds.includes(tag.id));
    if (!toCache.length) return;
    setExtraTags((previous) => addMissingTags(previous, toCache));
  };
  useEffect(() => {
    cacheSelectedTags(newSearchedTags, newSelectedTagIds);
  }, [newSearchedTags, newSelectedTagIds]);

  // Auto-create / select color for creation form
  useEffect(() => {
    if (!color) return;
    const existing = colorsList.find((paletteColor) => paletteColor.color.toLowerCase() === color.toLowerCase());
    if (existing) {
      setSelectedColorId(existing.id);
      setIsCreatingColorPending(false);
      return;
    }

    setIsCreatingColorPending(true);
    const timer = setTimeout(async () => {
      try {
        if (sessionColorId) {
          await updateColor({ id: sessionColorId, color }).unwrap();
          setSelectedColorId(sessionColorId);
        } else {
          const response = await createColor({ color }).unwrap();
          setSelectedColorId(response.data.id);
          setSessionColorId(response.data.id);
        }
      } catch (error) {
        console.error("Failed to create color dynamically", error);
      } finally {
        setIsCreatingColorPending(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [color, colorsList, createColor, updateColor, sessionColorId]);

  // Set default color from loaded list if color state is empty
  useEffect(() => {
    if (colorsList.length > 0 && !color) {
      setColor(colorsList[0].color);
      setSelectedColorId(colorsList[0].id);
    }
  }, [colorsList, color]);

  // Set default collection if empty
  useEffect(() => {
    if (collections.length > 0 && !form.getValues("collectionId")) {
      form.setValue("collectionId", collections[0].id, { shouldValidate: true });
    }
  }, [collections, form]);

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

  const resetForm = () => {
    setIsEditing(null);
    setActiveCategoryObj(null);
    form.reset({
      title: {},
      description: {},
      collectionId: collections[0]?.id ?? "",
      parentId: null,
      tagsIds: [],
      color: { id: "", color: "" },
    });
    // Empty color state makes the "default color" effect pick the first palette color again.
    setColor("");
    setSelectedColorId("");
    setSessionColorId("");
  };

  const handleEdit = (category: PopulatedCategory) => {
    setIsEditing(category.id);
    setActiveCategoryObj(category);
    setSessionColorId("");
    form.reset({
      title: typeof category.title === "string" ? { [locale]: category.title } : category.title || {},
      description: typeof category.description === "string" ? { [locale]: category.description } : category.description || {},
      collectionId: category.collectionId || "",
      parentId: category.parentId || null,
      tagsIds: category.tagsIds || category.tags?.map((tag) => tag.id) || [],
      color: { id: category.color?.id || "", color: category.color?.color || "" },
    });
    setColor(category.color?.color || "");
    setSelectedColorId(category.color?.id || "");
    if (category.tags?.length) {
      setExtraTags((previous) => mergeTagsById(previous, category.tags!));
    }
  };

  const onSubmit = async (values: z.infer<typeof categorySchema>) => {
    if (!selectedColorId || isCreatingColorPending) return;

    try {
      // Use the actual selected color details from state
      const submissionValues = {
        ...values,
        color: { id: selectedColorId, color: color },
      };

      if (isEditing) {
        // Keep the other locales' text: the form only edits the admin's own locale.
        const existingTitle = activeCategoryObj?.title && typeof activeCategoryObj.title === "object" ? activeCategoryObj.title : {};
        const existingDesc = activeCategoryObj?.description && typeof activeCategoryObj.description === "object" ? activeCategoryObj.description : {};
        await saveCategory({
          ...submissionValues,
          id: isEditing,
          title: { ...existingTitle, ...values.title },
          description: { ...existingDesc, ...values.description },
          parentId: values.parentId || null,
        }).unwrap();
      } else {
        await saveCategory(submissionValues).unwrap();
      }

      resetForm();
    } catch (error: unknown) {
      const apiError = error as ApiMutationError;
      if (apiError?.data?.error?.details) {
        apiError.data.error.details.forEach((detail) => {
          form.setError(detail.field as any, { type: "server", message: detail.message });
        });
      }
      console.error("Failed to save category", error);
    }
  };

  // Sync color state to form to ensure validation passes
  useEffect(() => {
    form.setValue("color.id", selectedColorId, { shouldValidate: true });
    form.setValue("color.color", color || "#000000", { shouldValidate: true });
  }, [selectedColorId, color, form]);

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("categories")}</h1>
        <p className="text-sm text-muted-foreground">{t("categories_subtitle")}</p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Category List */}
        <div className="lg:col-span-8 order-2 bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("categories")}</h2>
          </div>
          <div className="divide-y divide-border/45">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Loader2 className="animate-spin inline mr-2" size={16} />
                {t("loading_categories")}
              </div>
            ) : categories.length > 0 ? (
              <SortableCategoryGroup
                parentId={null}
                items={categories}
                onReorder={async (newItems) => {
                  const updates = [];
                  for (let index = 0; index < newItems.length; index++) {
                    const category = newItems[index];
                    if (category.order !== index) {
                      updates.push({ id: category.id, order: index });
                    }
                  }
                  if (updates.length > 0) {
                    try {
                      await reorderCategories(updates).unwrap();
                    } catch (error) {
                      console.error("Failed to reorder categories", error);
                    }
                  }
                }}
                renderItem={(category) => {
                  const catTitleLoc = getLocalizedField(category.title, locale);
                  const catDescLoc = getLocalizedField(category.description, locale);
                  const catColor = category.color?.color || "transparent";

                  return (
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors w-full">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground truncate">{catTitleLoc}</span>
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
                            style={{
                              backgroundColor: `${catColor}25`,
                              color: catColor,
                              border: `1px solid ${catColor}40`,
                            }}
                          >
                            HEX: {catColor}
                          </span>
                          {category.parentId && (() => {
                            const parentCat = categories.find((parentCandidate) => parentCandidate.id === category.parentId);
                            const parentTitle = parentCat ? getLocalizedField(parentCat.title, locale) : "";
                            return parentTitle ? (
                              <span className="text-[10px] font-medium text-[#7D8945] bg-[#7D8945]/10 px-2.5 py-0.5 rounded-full border border-[#7D8945]/20 flex items-center gap-1 font-sans">
                                {t("subcategory_of")} <strong className="truncate max-w-[100px] sm:max-w-[150px]">{parentTitle}</strong>
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 sm:mt-0.5 line-clamp-2">{catDescLoc}</p>
                      </div>
  
                      <RowActions>
                        <RowAction icon={Edit} title={t("edit_category")} active={isEditing === category.id} onClick={() => handleEdit(category)} />
                        <RowAction icon={Trash2} tone="destructive" title={t("delete")} onClick={() => handleDeleteClick(category.id)} />
                      </RowActions>
                    </div>
                  );
                }}
              />
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {t("no_categories")}
              </div>
            )}
          </div>
        </div>

        {/* Add / Edit Category */}
        <div className="lg:col-span-4 order-1 bg-card rounded-xl border border-border overflow-hidden h-fit">
          <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isEditing ? t("edit_category") : t("add_category")}
            </h3>
            {isEditing && (
              <button
                onClick={resetForm}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
              >
                <X size={12} />
                {t("cancel_action")}
              </button>
            )}
          </div>
          <div className="p-5 space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              
              <FormField
                control={form.control}
                name={`title.${locale}` as any}
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("title")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        type="text"
                        placeholder={t("placeholder_category_title")}
                      />
                    </FormControl>
                    <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`description.${locale}` as any}
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder={t("placeholder_category_desc")}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="collectionId"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("collections")}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={collections.map((collection) => ({ value: collection.id, label: getLocalizedField(collection.title, locale) }))}
                        value={field.value || ""}
                        onChange={(value) => field.onChange(value)}
                        placeholder={t("placeholder_select_collection")}
                        searchPlaceholder={t("placeholder_search_collections")}
                        clearable={false}
                      />
                    </FormControl>
                    <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("parent_category")}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={categories
                          .filter((candidate) => candidate.id !== isEditing)
                          .map((candidate) => ({ value: candidate.id, label: getLocalizedField(candidate.title, locale) }))}
                        value={field.value || ""}
                        onChange={(value) => field.onChange(value)}
                        placeholder={t("none_main_category")}
                        searchPlaceholder={t("placeholder_search_categories")}
                      />
                    </FormControl>
                    <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tagsIds"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("tags")}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={newTagOptions}
                        value={field.value || []}
                        onChange={(value) => field.onChange(value)}
                        placeholder={t("placeholder_select_tags")}
                        searchPlaceholder={t("placeholder_search_tags")}
                        allowCreate
                        createLabel={t("add_new_tag_prompt")}
                        multiple
                        onCreate={handleCreateTag}
                        serverSearch
                        onSearchChange={setNewTagSearch}
                        onEndReached={hasMoreNewTags ? loadMoreNewTags : undefined}
                        resolveLabel={resolveTagLabel}
                      />
                    </FormControl>
                    <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("color_accent")}</label>
                
                {/* Presets Grid */}
                {colorsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/40">
                    {colorsList.map((paletteColor) => (
                      <button
                        key={paletteColor.id}
                        type="button"
                        onClick={() => {
                          setColor(paletteColor.color);
                          setSelectedColorId(paletteColor.id);
                        }}
                        className={`w-6 h-6 rounded-[6px] border transition-all hover:scale-110 cursor-pointer ${
                          color.toLowerCase() === paletteColor.color.toLowerCase()
                            ? "border-primary ring-2 ring-primary/20 scale-105"
                            : "border-border"
                        }`}
                        style={{ backgroundColor: paletteColor.color }}
                        title={paletteColor.color}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <ColorPicker value={color} onChange={(event) => setColor(event.target.value)} />
                  <span className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">{color}</span>
                  {isCreatingColorPending && (
                    <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" />
                      {t("saving_color")}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!form.formState.isValid || isSaving || isCreatingColorPending}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {(isSaving || isCreatingColorPending) ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isEditing ? (
                  <Save size={16} />
                ) : (
                  <Plus size={16} />
                )}
                {isEditing ? t("save") : t("add_category")}
              </button>
            </form>
          </Form>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("categories")}
        message={t("delete_confirm_category")}
        confirmText={t("delete") || "Delete"}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmDelete}
        onClose={handleDeleteClose}
      />
    </div>
  );
}
