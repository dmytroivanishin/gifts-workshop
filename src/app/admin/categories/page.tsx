"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Save, X, Loader2 } from "lucide-react";
import { 
  useGetCategoriesQuery, 
  useCreateCategoryMutation, 
  useGetTagsQuery,
  useCreateTagMutation,
  useGetCollectionsQuery,
  useGetColorsQuery,
  useCreateColorMutation,
  useUpdateColorMutation
} from "@/store/api";
import Combobox from "@/components/ui/combobox";
import { useTranslation } from "@/i18n";

export default function AdminCategories() {
  const { t, loc } = useTranslation();

  const { data: categoriesResponse, isLoading } = useGetCategoriesQuery();
  const { data: tagsResponse } = useGetTagsQuery();
  const { data: collectionsResponse } = useGetCollectionsQuery();
  const { data: colorsResponse } = useGetColorsQuery();
  const [saveCategory, { isLoading: isSaving }] = useCreateCategoryMutation();
  const [createTag] = useCreateTagMutation();
  const [createColor] = useCreateColorMutation();
  const [updateColor] = useUpdateColorMutation();

  const categories = categoriesResponse?.data || [];
  const allTags = tagsResponse?.data || [];
  const colorsList = colorsResponse?.data || [];
  const tagOptions = allTags.map((tag: any) => ({ 
    value: tag.id, 
    label: loc(tag.name) 
  }));

  const [isEditing, setIsEditing] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [selectedColorId, setSelectedColorId] = useState("");
  const [sessionColorId, setSessionColorId] = useState("");
  const [isCreatingColorPending, setIsCreatingColorPending] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [parentId, setParentId] = useState("");

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
  const [activeCategoryObj, setActiveCategoryObj] = useState<any>(null);

  // Auto-create / select color for creation form
  useEffect(() => {
    if (!color) return;
    const existing = colorsList.find((c: any) => c.color.toLowerCase() === color.toLowerCase());
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

  // Auto-create / select color for edit form
  useEffect(() => {
    if (!editColor || !isEditing) return;
    const existing = colorsList.find((c: any) => c.color.toLowerCase() === editColor.toLowerCase());
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
        title: { ru: name, en: "" },
      }).unwrap();
      return res.data.id;
    } catch (err) {
      console.error("Failed to create tag dynamically", err);
      return "";
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !collectionId || !selectedColorId || isCreatingColorPending) return;

    try {
      await saveCategory({
        title: { ru: title, en: "" },
        description: { ru: description, en: "" },
        color: { id: selectedColorId, color: color },
        collectionId: collectionId,
        parentId: parentId || null,
        tagsIds: selectedTags,
      }).unwrap();

      setTitle("");
      setDescription("");
      setColor("#FFD2D2");
      setSelectedTags([]);
      setCollectionId("");
      setParentId("");
      setSessionColorId("");
    } catch (err) {
      console.error("Failed to add category", err);
    }
  };

  const handleSave = async (id: string) => {
    if (!editTitle || !editCollectionId || !editSelectedColorId || isEditingColorPending) return;
    try {
      const existingEnTitle = activeCategoryObj?.title && typeof activeCategoryObj.title === "object"
        ? activeCategoryObj.title.en
        : "";
      const existingEnDesc = activeCategoryObj?.description && typeof activeCategoryObj.description === "object"
        ? activeCategoryObj.description.en
        : "";

      await saveCategory({
        id,
        title: { ru: editTitle, en: existingEnTitle || "" },
        description: { ru: editDescription, en: existingEnDesc || "" },
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

  const handleStartEdit = (cat: any) => {
    setIsEditing(cat.id);
    setActiveCategoryObj(cat);
    setEditTitle(typeof cat.title === "string" ? cat.title : cat.title?.ru || "");
    setEditDescription(typeof cat.description === "string" ? cat.description : cat.description?.ru || "");
    setEditColor(cat.color?.color || "#FFD2D2");
    setEditSelectedColorId(cat.color?.id || "");
    setEditCollectionId(cat.collectionId || "");
    setEditParentId(cat.parentId || "");
    setEditSelectedTags(cat.tagsIds || cat.tags?.map((t: any) => t.id) || []);
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("categories")}</h1>
        <p className="text-sm text-muted-foreground">{t("categories_subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Category List */}
        <div className="lg:col-span-8 bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
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
              categories.map((cat: any) => {
                const catTitleRu = typeof cat.title === "string" ? cat.title : cat.title?.ru || "";
                const catDescRu = typeof cat.description === "string" ? cat.description : cat.description?.ru || "";
                const catColor = cat.color?.color || "transparent";

                return (
                  <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    {isEditing === cat.id ? (
                      <div className="flex-1 space-y-3 mr-4">
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder={t("title")}
                            className="w-full px-3 py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder={t("description")}
                            className="w-full px-3 py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("collections")}</label>
                          <select
                            value={editCollectionId}
                            onChange={(e) => setEditCollectionId(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
                            required
                          >
                            <option value="" disabled>{t("placeholder_select_collection")}</option>
                            {collections.map((col: any) => (
                              <option key={col.id} value={col.id} className="bg-card text-foreground">
                                {col.title?.ru || col.title?.en || col.title || ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("parent_category")}</label>
                          <select
                            value={editParentId}
                            onChange={(e) => setEditParentId(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
                          >
                            <option value="">{t("none_main_category")}</option>
                            {categories
                              .filter((c: any) => c.id !== cat.id)
                              .map((c: any) => (
                                <option key={c.id} value={c.id} className="bg-card text-foreground">
                                  {c.title?.ru || c.title?.en || c.title || ""}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("tags")}</label>
                          <Combobox
                            options={tagOptions}
                            value={editSelectedTags}
                            onChange={(val) => setEditSelectedTags(val)}
                            placeholder={t("placeholder_select_tags")}
                            searchPlaceholder={t("placeholder_search_tags")}
                            allowCreate
                            createLabel={t("add_new_tag_prompt")}
                            multiple
                            onCreate={handleCreateTag}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("color_accent")}</label>
                          {/* Presets Grid */}
                          {colorsList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 p-1.5 rounded-lg bg-muted/30 border border-border/40">
                              {colorsList.map((c: any) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setEditColor(c.color);
                                    setEditSelectedColorId(c.id);
                                  }}
                                  className={`w-5 h-5 rounded-full border transition-all hover:scale-110 cursor-pointer ${
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
                              className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
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
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{catTitleRu}</span>
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
                            const parentCat = categories.find((c: any) => c.id === cat.parentId);
                            const parentTitle = parentCat
                              ? (typeof parentCat.title === "string"
                                ? parentCat.title
                                : parentCat.title?.ru || parentCat.title?.en || "")
                              : "";
                            return parentTitle ? (
                              <span className="text-[11px] font-medium text-[#7D8945] bg-[#7D8945]/10 px-2.5 py-0.5 rounded-md border border-[#7D8945]/20 flex items-center gap-1 font-sans">
                                {t("subcategory_of")} <strong>{parentTitle}</strong>
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{catDescRu}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 ml-4">
                      {isEditing === cat.id ? (
                        <>
                           <button
                             onClick={() => handleSave(cat.id)}
                             disabled={isEditingColorPending}
                             className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center justify-center"
                           >
                             {isEditingColorPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                           </button>
                          <button
                            onClick={() => {
                              setIsEditing(null);
                              setActiveCategoryObj(null);
                            }}
                            className="p-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(cat)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Edit size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {t("no_categories")}
              </div>
            )}
          </div>
        </div>

        {/* Add New Category */}
        <div className="lg:col-span-4 bg-card rounded-xl border border-border/40 p-5 h-fit space-y-4 shadow-sm">
          <h3 className="font-semibold text-sm text-foreground border-b pb-2">{t("add_category")}</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("title")}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("placeholder_category_title")}
                className="w-full px-3.5 py-2 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("placeholder_category_desc")}
                className="w-full px-3.5 py-2 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("collections")}</label>
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
                required
              >
                <option value="" disabled>{t("placeholder_select_collection")}</option>
                {collections.map((col: any) => (
                  <option key={col.id} value={col.id} className="bg-card text-foreground">
                    {col.title?.ru || col.title?.en || col.title || ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("parent_category")}</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">{t("none_main_category")}</option>
                {categories.map((c: any) => {
                  const titleStr = typeof c.title === "string" ? c.title : c.title?.ru || "";
                  return (
                    <option key={c.id} value={c.id} className="bg-card text-foreground">
                      {titleStr}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("tags")}</label>
              <Combobox
                options={tagOptions}
                value={selectedTags}
                onChange={(val) => setSelectedTags(val)}
                placeholder={t("placeholder_select_tags")}
                searchPlaceholder={t("placeholder_search_tags")}
                allowCreate
                createLabel={t("add_new_tag_prompt")}
                multiple
                onCreate={handleCreateTag}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("color_accent")}</label>
               
               {/* Presets Grid */}
               {colorsList.length > 0 && (
                 <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/40">
                   {colorsList.map((c: any) => (
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
               disabled={isSaving || isCreatingColorPending}
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
        </div>
      </div>
    </div>
  );
}
