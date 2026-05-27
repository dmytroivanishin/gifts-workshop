"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Save, X, Loader2 } from "lucide-react";
import { 
  useGetCategoriesQuery, 
  useCreateCategoryMutation, 
  useGetTagsQuery,
  useCreateTagMutation,
  useGetCollectionsQuery
} from "@/store/api";
import Combobox from "@/components/ui/combobox";

export default function AdminCategories() {
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const { data: categoriesResponse, isLoading, isFetching } = useGetCategoriesQuery({ page, limit: 10 });
  const { data: tagsResponse } = useGetTagsQuery();
  const { data: collectionsResponse } = useGetCollectionsQuery();
  const [saveCategory, { isLoading: isSaving }] = useCreateCategoryMutation();
  const [createTag] = useCreateTagMutation();

  const allTags = tagsResponse?.data || [];
  const tagOptions = allTags.map((tag: any) => ({ 
    value: tag.id, 
    label: tag.title?.ru || tag.title?.en || tag.title || "" 
  }));

  const [isEditing, setIsEditing] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#FFD2D2");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [collectionId, setCollectionId] = useState("");

  const collections = collectionsResponse?.data || [];

  // Edit State
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editCollectionId, setEditCollectionId] = useState("");
  const [editSelectedTags, setEditSelectedTags] = useState<string[]>([]);
  const [activeCategoryObj, setActiveCategoryObj] = useState<any>(null);

  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Sync loaded page chunk to categories list
  useEffect(() => {
    if (categoriesResponse?.data) {
      if (page === 1) {
        setCategories(categoriesResponse.data);
      } else {
        setCategories((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newCats = categoriesResponse.data.filter((c: any) => !existingIds.has(c.id));
          return [...prev, ...newCats];
        });
      }
      setHasMore(categoriesResponse.meta?.nextPage !== null);
    }
  }, [categoriesResponse, page]);

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
    if (!title || !collectionId) return;

    try {
      await saveCategory({
        title: { ru: title, en: "" },
        description: { ru: description, en: "" },
        color: { id: `color-${Date.now()}`, color: color },
        collectionId: collectionId,
        tagsIds: selectedTags,
      }).unwrap();

      setTitle("");
      setDescription("");
      setColor("#FFD2D2");
      setSelectedTags([]);
      setCollectionId("");
      setPage(1); // Reset to page 1 to reload
    } catch (err) {
      console.error("Failed to add category", err);
    }
  };

  const handleSave = async (id: string) => {
    if (!editTitle || !editCollectionId) return;
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
        color: { id: `color-${Date.now()}`, color: editColor },
        collectionId: editCollectionId,
        tagsIds: editSelectedTags,
      }).unwrap();
      setIsEditing(null);
      setActiveCategoryObj(null);
      setPage(1); // Reset to page 1 to reload
    } catch (err) {
      console.error("Failed to save category", err);
    }
  };

  const handleStartEdit = (cat: any) => {
    setIsEditing(cat.id);
    setActiveCategoryObj(cat);
    setEditTitle(typeof cat.title === "string" ? cat.title : cat.title?.ru || "");
    setEditDescription(typeof cat.description === "string" ? cat.description : cat.description?.ru || "");
    setEditColor(typeof cat.color === "object" ? cat.color?.color : cat.color || "#FFD2D2");
    setEditCollectionId(cat.collectionId || "");
    setEditSelectedTags(cat.tagsIds || cat.tags?.map((t: any) => t.id) || []);
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Categories Manager</h1>
        <p className="text-sm text-muted-foreground">Manage work categories and custom accent color styling.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Category List */}
        <div className="lg:col-span-8 bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold text-foreground">All Categories</h2>
          </div>
          <div className="divide-y divide-border/45">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Loader2 className="animate-spin inline mr-2" size={16} />
                Loading categories...
              </div>
            ) : categories.length > 0 ? (
              categories.map((cat: any) => {
                const catTitleRu = typeof cat.title === "string" ? cat.title : cat.title?.ru || "";
                const catDescRu = typeof cat.description === "string" ? cat.description : cat.description?.ru || "";
                const catColor = typeof cat.color === "object" ? cat.color?.color : cat.color || "#FFD2D2";

                return (
                  <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    {isEditing === cat.id ? (
                      <div className="flex-1 space-y-3 mr-4">
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Title"
                            className="w-full px-3 py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Description"
                            className="w-full px-3 py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collection</label>
                          <select
                            value={editCollectionId}
                            onChange={(e) => setEditCollectionId(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
                            required
                          >
                            <option value="" disabled>Select a collection...</option>
                            {collections.map((col: any) => (
                              <option key={col.id} value={col.id} className="bg-card text-foreground">
                                {col.title?.ru || col.title?.en || col.title || ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</label>
                          <Combobox
                            options={tagOptions}
                            value={editSelectedTags}
                            onChange={(val) => setEditSelectedTags(val)}
                            placeholder="Select tags..."
                            searchPlaceholder="Search or type new tag..."
                            allowCreate
                            createLabel='Add new tag "{search}"'
                            multiple
                            onCreate={handleCreateTag}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-muted-foreground">Custom Color:</label>
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                          />
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
                          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/40">
                            Collection: {cat.collection?.title?.ru || cat.collection?.title || ""}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{catDescRu}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 ml-4">
                      {isEditing === cat.id ? (
                        <>
                          <button
                            onClick={() => handleSave(cat.id)}
                            className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
                          >
                            <Save size={16} />
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
                No categories found.
              </div>
            )}
            {categories.length > 0 && hasMore && (
              <div ref={loaderRef} className="p-4 flex items-center justify-center text-sm text-muted-foreground border-t border-border/45 bg-muted/5">
                <Loader2 className="animate-spin mr-2 animate-duration-1000" size={16} />
                Loading more categories...
              </div>
            )}
          </div>
        </div>

        {/* Add New Category */}
        <div className="lg:col-span-4 bg-card rounded-xl border border-border/40 p-5 h-fit space-y-4 shadow-sm">
          <h3 className="font-semibold text-sm text-foreground border-b pb-2">Add New Category</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Плюшевые истории"
                className="w-full px-3.5 py-2 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Category description..."
                className="w-full px-3.5 py-2 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collection</label>
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
                required
              >
                <option value="" disabled>Select a collection...</option>
                {collections.map((col: any) => (
                  <option key={col.id} value={col.id} className="bg-card text-foreground">
                    {col.title?.ru || col.title?.en || col.title || ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</label>
              <Combobox
                options={tagOptions}
                value={selectedTags}
                onChange={(val) => setSelectedTags(val)}
                placeholder="Select tags..."
                searchPlaceholder="Search or type new tag..."
                allowCreate
                createLabel='Add new tag "{search}"'
                multiple
                onCreate={handleCreateTag}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Color Accent</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                />
                <span className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">{color}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              <Plus size={16} />
              Create Category
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
