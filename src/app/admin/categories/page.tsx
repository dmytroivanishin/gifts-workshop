"use client";

import { useState, useEffect, useRef } from "react";
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
import Combobox from "@/components/ui/combobox";
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
  // Two independent search states/hooks, one per Combobox instance — the inline edit row and
  // the always-visible "Add New Category" form can both be on screen at once, so sharing one
  // search state would make typing in either combobox's search box narrow both of them.
  const [editTagSearch, setEditTagSearch] = useState("");
  const { tags: editSearchedTags, hasMore: hasMoreEditTags, loadMore: loadMoreEditTags } = useTagsList(editTagSearch);
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
  const editTagOptions = editSearchedTags.map((tag) => ({
    value: tag.id,
    label: loc(tag.name)
  }));
  const newTagOptions = newSearchedTags.map((tag) => ({
    value: tag.id,
    label: loc(tag.name)
  }));
  const resolveTagLabel = (id: string) => {
    const tag = extraTags.find((t) => t.id === id);
    return tag ? loc(tag.name) : undefined;
  };

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState("");

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
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSelectedColorId, setEditSelectedColorId] = useState("");
  const [editSessionColorId, setEditSessionColorId] = useState("");
  const [isEditingColorPending, setIsEditingColorPending] = useState(false);
  const [editCollectionId, setEditCollectionId] = useState("");
  const [editParentId, setEditParentId] = useState("");
  const [editSelectedTags, setEditSelectedTags] = useState<string[]>([]);
  const [activeCategoryObj, setActiveCategoryObj] = useState<PopulatedCategory | null>(null);

  // Opportunistically cache any currently-selected tag the moment it's visible in its
  // Combobox's own searched-tags page — without this, selecting a tag while unsearched and
  // then typing an unrelated search term would narrow the options away from it, and its chip
  // would fall back to showing the raw id (resolveTagLabel only has what's in extraTags).
  const newSelectedTagIds: string[] = form.watch("tagsIds") || [];
  const cacheSelectedTags = (searched: Tag[], selectedIds: string[]) => {
    const toCache = searched.filter((tag) => selectedIds.includes(tag.id));
    if (!toCache.length) return;
    setExtraTags((prev) => {
      const merged = new Map(prev.map((t) => [t.id, t]));
      let changed = false;
      for (const tag of toCache) {
        if (!merged.has(tag.id)) {
          merged.set(tag.id, tag);
          changed = true;
        }
      }
      return changed ? Array.from(merged.values()) : prev;
    });
  };
  useEffect(() => {
    cacheSelectedTags(editSearchedTags, editSelectedTags);
  }, [editSearchedTags, editSelectedTags]);
  useEffect(() => {
    cacheSelectedTags(newSearchedTags, newSelectedTagIds);
  }, [newSearchedTags, newSelectedTagIds]);

  // Auto-create / select color for creation form
  useEffect(() => {
    if (!color) return;
    const existing = colorsList.find((c) => c.color.toLowerCase() === color.toLowerCase());
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
          const res = await createColor({ color }).unwrap();
          setSelectedColorId(res.data.id);
          setSessionColorId(res.data.id);
        }
      } catch (err) {
        console.error("Failed to create color dynamically", err);
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

  // Auto-create / select color for edit form
  useEffect(() => {
    if (!editColor || !isEditing) return;
    const existing = colorsList.find((c) => c.color.toLowerCase() === editColor.toLowerCase());
    if (existing) {
      setEditSelectedColorId(existing.id);
      setIsEditingColorPending(false);
      return;
    }

    setIsEditingColorPending(true);
    const timer = setTimeout(async () => {
      try {
        if (editSessionColorId) {
          await updateColor({ id: editSessionColorId, color: editColor }).unwrap();
          setEditSelectedColorId(editSessionColorId);
        } else {
          const res = await createColor({ color: editColor }).unwrap();
          setEditSelectedColorId(res.data.id);
          setEditSessionColorId(res.data.id);
        }
      } catch (err) {
        console.error("Failed to create color dynamically in edit modal", err);
      } finally {
        setIsEditingColorPending(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [editColor, colorsList, createColor, updateColor, isEditing, editSessionColorId]);

  const handleCreateTag = async (name: string) => {
    try {
      const res = await createTag({
        name: { [locale]: name },
      }).unwrap();
      setExtraTags((prev) => [...prev, res.data]);
      return res.data.id;
    } catch (err) {
      console.error("Failed to create tag dynamically", err);
      return "";
    }
  };

  const handleAdd = async (values: z.infer<typeof categorySchema>) => {
    if (!selectedColorId || isCreatingColorPending) return;

    try {
      // Use the actual selected color details from state
      const submissionValues = {
        ...values,
        color: { id: selectedColorId, color: color },
      };

      await saveCategory(submissionValues).unwrap();

      form.reset();
      setColor("");
      setSelectedColorId("");
      setSessionColorId("");
    } catch (err: unknown) {
      const apiError = err as ApiMutationError;
      if (apiError?.data?.error?.details) {
        apiError.data.error.details.forEach((detail) => {
          form.setError(detail.field as any, { type: "server", message: detail.message });
        });
      }
      console.error("Failed to add category", err);
    }
  };

  // Sync color state to form to ensure validation passes
  useEffect(() => {
    form.setValue("color.id", selectedColorId, { shouldValidate: true });
    form.setValue("color.color", color || "#000000", { shouldValidate: true });
  }, [selectedColorId, color, form]);

  const handleSave = async (id: string) => {
    if (!editTitle || !editCollectionId || !editSelectedColorId || isEditingColorPending) return;
    try {
      const existingTitle = activeCategoryObj?.title && typeof activeCategoryObj.title === "object" ? activeCategoryObj.title : {};
      const existingDesc = activeCategoryObj?.description && typeof activeCategoryObj.description === "object" ? activeCategoryObj.description : {};

      await saveCategory({
        id,
        title: { ...existingTitle, [locale]: editTitle },
        description: { ...existingDesc, [locale]: editDescription },
        color: { id: editSelectedColorId, color: editColor },
        collectionId: editCollectionId,
        parentId: editParentId || null,
        tagsIds: editSelectedTags,
      }).unwrap();
      setIsEditing(null);
      setActiveCategoryObj(null);
      setEditSessionColorId("");
    } catch (err) {
      console.error("Failed to save category", err);
    }
  };

  const handleStartEdit = (cat: PopulatedCategory) => {
    setIsEditing(cat.id);
    setActiveCategoryObj(cat);
    setEditTitle(getLocalizedField(cat.title, locale));
    setEditDescription(getLocalizedField(cat.description, locale));
    setEditColor(cat.color?.color || (colorsList.length > 0 ? colorsList[0].color : "#000000"));
    setEditSelectedColorId(cat.color?.id || (colorsList.length > 0 ? colorsList[0].id : ""));
    setEditCollectionId(cat.collectionId || "");
    setEditParentId(cat.parentId || "");
    setEditSelectedTags(cat.tagsIds || cat.tags?.map((t) => t.id) || []);
    if (cat.tags?.length) {
      setExtraTags((prev) => {
        const merged = new Map(prev.map((tag) => [tag.id, tag]));
        for (const tag of cat.tags!) merged.set(tag.id, tag);
        return Array.from(merged.values());
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteCategory(deleteTargetId).unwrap();
    } catch (error) {
      console.error("Failed to delete category", error);
    } finally {
      setIsDeleteOpen(false);
      setDeleteTargetId("");
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("categories")}</h1>
        <p className="text-sm text-muted-foreground">{t("categories_subtitle")}</p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Category List */}
        <div className="lg:col-span-8 order-2 bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold text-foreground">{t("categories")}</h2>
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
                  for (let i = 0; i < newItems.length; i++) {
                    const cat = newItems[i];
                    if (cat.order !== i) {
                      updates.push({ id: cat.id, order: i });
                    }
                  }
                  if (updates.length > 0) {
                    try {
                      await reorderCategories(updates).unwrap();
                    } catch (err) {
                      console.error("Failed to reorder categories", err);
                    }
                  }
                }}
                renderItem={(cat) => {
                  const catTitleLoc = getLocalizedField(cat.title, locale);
                  const catDescLoc = getLocalizedField(cat.description, locale);
                  const catColor = cat.color?.color || "transparent";

                  return (
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors w-full">
                      {isEditing === cat.id ? (
                        <div className="flex-1 space-y-4 sm:space-y-3 w-full">
                          <div className="grid grid-cols-1 gap-2">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder={t("title")}
                              className="w-full px-3 py-2 sm:py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder={t("description")}
                              className="w-full px-3 py-2 sm:py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
                              rows={2}
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("collections")}</label>
                            <select
                              value={editCollectionId}
                              onChange={(e) => setEditCollectionId(e.target.value)}
                              className="w-full px-3 py-2 sm:py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
                              required
                            >
                              <option value="" disabled>{t("placeholder_select_collection")}</option>
                              {collections.map((col) => (
                                <option key={col.id} value={col.id} className="bg-card text-foreground">
                                  {getLocalizedField(col.title, locale)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("parent_category")}</label>
                            <select
                              value={editParentId}
                              onChange={(e) => setEditParentId(e.target.value)}
                              className="w-full px-3 py-2 sm:py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
                            >
                              <option value="">{t("none_main_category")}</option>
                              {categories
                                .filter((c) => c.id !== cat.id)
                                .map((c) => (
                                  <option key={c.id} value={c.id} className="bg-card text-foreground">
                                    {getLocalizedField(c.title, locale)}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("tags")}</label>
                            <Combobox
                              options={editTagOptions}
                              value={editSelectedTags}
                              onChange={(val) => setEditSelectedTags(val as string[])}
                              placeholder={t("placeholder_select_tags")}
                              searchPlaceholder={t("placeholder_search_tags")}
                              allowCreate
                              createLabel={t("add_new_tag_prompt")}
                              multiple
                              onCreate={handleCreateTag}
                              serverSearch
                              onSearchChange={setEditTagSearch}
                              onEndReached={hasMoreEditTags ? loadMoreEditTags : undefined}
                              resolveLabel={resolveTagLabel}
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("color_accent")}</label>
                            {/* Presets Grid */}
                            {colorsList.length > 0 && (
                              <div className="flex flex-wrap gap-2 sm:gap-1.5 p-2 sm:p-1.5 rounded-lg bg-muted/30 border border-border/40">
                                {colorsList.map((c) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      setEditColor(c.color);
                                      setEditSelectedColorId(c.id);
                                    }}
                                    className={`w-6 h-6 sm:w-5 sm:h-5 rounded-full border transition-all hover:scale-110 cursor-pointer ${
                                      editColor.toLowerCase() === c.color.toLowerCase()
                                        ? "border-primary ring-2 ring-primary/20 scale-105"
                                        : "border-border/60"
                                    }`}
                                    style={{ backgroundColor: c.color }}
                                    title={c.color}
                                  />
                                ))}
                              </div>
                            )}
  
                            <div className="flex items-center gap-3">
                              <input
                                type="color"
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                              />
                              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{editColor}</span>
                              {isEditingColorPending && (
                                <span className="text-[10px] text-muted-foreground animate-pulse flex items-center gap-1">
                                  <Loader2 size={10} className="animate-spin" />
                                  Сохранение цвета...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">{catTitleLoc}</span>
                            <span
                              className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider"
                              style={{
                                backgroundColor: `${catColor}25`,
                                color: catColor,
                                border: `1px solid ${catColor}40`,
                              }}
                            >
                              HEX: {catColor}
                            </span>
                            {cat.parentId && (() => {
                              const parentCat = categories.find((c) => c.id === cat.parentId);
                              const parentTitle = parentCat ? getLocalizedField(parentCat.title, locale) : "";
                              return parentTitle ? (
                                <span className="text-[11px] font-medium text-[#7D8945] bg-[#7D8945]/10 px-2.5 py-0.5 rounded-md border border-[#7D8945]/20 flex items-center gap-1 font-sans">
                                  {t("subcategory_of")} <strong className="truncate max-w-[100px] sm:max-w-[150px]">{parentTitle}</strong>
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5 sm:mt-0.5 line-clamp-2">{catDescLoc}</p>
                        </div>
                      )}
  
                      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                        {isEditing === cat.id ? (
                          <>
                             <button
                               onClick={() => handleSave(cat.id)}
                               disabled={isEditingColorPending}
                               className="p-2 sm:p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center justify-center"
                             >
                               {isEditingColorPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                             </button>
                            <button
                              onClick={() => {
                                setIsEditing(null);
                                setActiveCategoryObj(null);
                              }}
                              className="p-2 sm:p-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
                            >
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEdit(cat)}
                              className="p-2 sm:p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(cat.id)}
                              className="p-2 sm:p-1.5 rounded-md hover:bg-muted hover:text-destructive transition-colors text-muted-foreground cursor-pointer"
                              title={t("delete")}
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
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

        {/* Add New Category */}
        <div className="lg:col-span-4 order-1 bg-card rounded-xl border border-border/40 p-5 h-fit space-y-4 shadow-sm">
          <h3 className="font-semibold text-sm text-foreground border-b pb-2">{t("add_category")}</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAdd)} className="space-y-4" noValidate>
              
              <FormField
                control={form.control}
                name={`title.${locale}` as any}
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("title")}</FormLabel>
                    <FormControl>
                      <input
                        {...field}
                        value={field.value || ""}
                        type="text"
                        placeholder={t("placeholder_category_title")}
                        className={`w-full px-3.5 py-2 rounded-lg border bg-transparent text-sm outline-none focus:border-primary ${form.formState.errors.title ? "border-destructive text-destructive focus:border-destructive" : "border-border"}`}
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
                      <textarea
                        {...field}
                        value={field.value || ""}
                        placeholder={t("placeholder_category_desc")}
                        className="w-full px-3.5 py-2 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
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
                      <select
                        {...field}
                        className={`w-full px-3.5 py-2.5 rounded-lg border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer ${form.formState.errors.collectionId ? "border-destructive text-destructive focus:border-destructive" : "border-border"}`}
                      >
                        <option value="" disabled>{t("placeholder_select_collection")}</option>
                        {collections.map((col) => (
                          <option key={col.id} value={col.id} className="bg-card text-foreground">
                            {getLocalizedField(col.title, locale)}
                          </option>
                        ))}
                      </select>
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
                      <select
                        {...field}
                        value={field.value || ""}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
                      >
                        <option value="">{t("none_main_category")}</option>
                        {categories.map((c) => {
                          const titleStr = getLocalizedField(c.title, locale);
                          return (
                            <option key={c.id} value={c.id} className="bg-card text-foreground">
                              {titleStr}
                            </option>
                          );
                        })}
                      </select>
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
                        onChange={(val) => field.onChange(val)}
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
                    {colorsList.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setColor(c.color);
                          setSelectedColorId(c.id);
                        }}
                        className={`w-6 h-6 rounded-full border transition-all hover:scale-110 cursor-pointer ${
                          color.toLowerCase() === c.color.toLowerCase()
                            ? "border-primary ring-2 ring-primary/20 scale-105"
                            : "border-border/60"
                        }`}
                        style={{ backgroundColor: c.color }}
                        title={c.color}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                  />
                  <span className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">{color}</span>
                  {isCreatingColorPending && (
                    <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" />
                      Сохранение цвета...
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
                ) : (
                  <Plus size={16} />
                )}
                {t("add_category")}
              </button>
            </form>
          </Form>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("categories")}
        message={t("delete_confirm_category")}
        confirmText={t("delete") || "Delete"}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
      />
    </div>
  );
}
