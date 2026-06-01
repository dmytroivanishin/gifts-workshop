"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Save, Loader2, Image as ImageIcon, Move } from "lucide-react";
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

interface SelectedMedia {
  mediaId: string;
  url: string;
  position?: { x: number; y: number; zoom: number };
}

// Removed PRESET_IMAGES

interface ProjectFormPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectFormPage({ params }: ProjectFormPageProps) {
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
  const { data: tagsResponse } = useGetTagsQuery();
  const { data: collectionsResponse } = useGetCollectionsQuery();
  const [createTag] = useCreateTagMutation();

  const categories = categoriesResponse?.data || [];
  const allTags = tagsResponse?.data || [];
  const collections = collectionsResponse?.data || [];
  const { data: mediaResponse } = useGetMediaQuery();
  const mediaList = mediaResponse?.data || [];

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [inStock, setInStock] = useState(true);
  const [status, setStatus] = useState("Published");
  const [selectedImages, setSelectedImages] = useState<SelectedMedia[]>([]);
  const [coverImage, setCoverImage] = useState(""); // mediaId of cover
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Position crop state
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

  // Populate form if in Edit Mode
  useEffect(() => {
    if (isEditMode && postResponse?.data) {
      const post = postResponse.data;
      
      setTitle(typeof post.title === "string" ? post.title : post.title?.[locale] || post.title?.ru || "");
      setDescription(typeof post.description === "string" ? post.description : post.description?.[locale] || post.description?.ru || "");
      
      const cat = typeof post.category !== "string" ? post.category?.id || "" : post.category;
      setCategoryId(cat);
      const col = typeof post.collection !== "string" ? post.collection?.id || "" : post.collection;
      setCollectionId(col || post.collectionId || "");
      setInStock(post.in_stock);
      setStatus(post.status);
      
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

      if (post.tags) {
        const tagIds = post.tags.map((t: any) => typeof t === "string" ? t : t.id);
        setSelectedTags(tagIds);
      }
    }
  }, [isEditMode, postResponse]);

  // Auto-select defaults when only one option exists (for creation mode)
  useEffect(() => {
    if (!isEditMode) {
      if (!collectionId && collections.length === 1) {
        setCollectionId(collections[0].id);
      }
      if (!categoryId && categories.length === 1) {
        const defaultCat = categories[0];
        setCategoryId(defaultCat.id);
        if (defaultCat.tagsIds && defaultCat.tagsIds.length > 0) {
          setSelectedTags(defaultCat.tagsIds);
        }
      }
    }
  }, [isEditMode, collections, categories, collectionId, categoryId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !categoryId || !collectionId) return;

    // Build media array
    const media = selectedImages.map((img, index) => {
      const existingRelation = postResponse?.data?.media?.find(
        (m: any) => (m.mediaId || m.media?.id) === img.mediaId
      );

      return {
        id: existingRelation?.id || undefined,
        order: index + 1,
        mediaId: img.mediaId,
        position: img.position || undefined,
      };
    });

    // Build poster with exact image position coordinates
    const coverMedia = selectedImages.find(m => m.mediaId === coverImage);
    const poster = coverMedia
      ? {
          id: coverMedia.mediaId,
          thumbnailUrl: coverMedia.url,
          originalUrl: coverMedia.url,
          position: coverPosition || undefined,
        }
      : undefined;

    const existingTitle = postResponse?.data?.title && typeof postResponse.data.title === "object" ? postResponse.data.title : {};
    const existingDesc = postResponse?.data?.description && typeof postResponse.data.description === "object" ? postResponse.data.description : {};

    const payload = {
      title: { ...existingTitle, [locale]: title },
      description: { ...existingDesc, [locale]: description },
      categoryId,
      collectionId,
      in_stock: inStock,
      status: status as any,
      media,
      poster,
      posterId: coverImage || undefined,
      tagsIds: selectedTags,
    };

    try {
      if (isEditMode) {
        await updatePost({
          id,
          ...payload,
        }).unwrap();
      } else {
        await createPost(payload).unwrap();
      }

      router.push("/admin/dashboard");
    } catch (err) {
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

  const activeCategory = categories.find((cat) => cat.id === categoryId);

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
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-xl border border-border/40 p-6 space-y-4 shadow-sm">
          
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
              {t("title")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("placeholder_project_title")}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
          </div>

          {/* Collection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
              {t("collection")}
            </label>
            <Combobox
              options={collectionOptions}
              value={collectionId}
              onChange={(val) => setCollectionId(val)}
              placeholder={t("placeholder_select_collection")}
              searchPlaceholder={t("placeholder_search_collections")}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
              {t("category")}
            </label>
            <Combobox
              options={categoryOptions}
              value={categoryId}
             onChange={(val) => {
                const oldCat = categories.find((cat) => cat.id === categoryId);
                const oldTags = oldCat?.tagsIds || [];

                setCategoryId(val);

                const newCat = categories.find((cat) => cat.id === val);
                const newTags = newCat?.tagsIds || [];

                setSelectedTags((prev) => {
                  const filtered = prev.filter((tId) => !oldTags.includes(tId));
                  return Array.from(new Set([...filtered, ...newTags]));
                });
              }}
              placeholder={t("placeholder_select_category")}
              searchPlaceholder={t("placeholder_search_categories")}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
              {t("description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("placeholder_project_desc")}
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
          </div>

          {/* Tags Combobox with Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
              {t("tags")}
            </label>
            <Combobox
              options={tagOptions}
              value={selectedTags}
              onChange={(val) => setSelectedTags(val)}
              placeholder={t("placeholder_select_tags")}
              searchPlaceholder={t("placeholder_search_or_type_tag")}
              allowCreate
              createLabel={t("add_new_tag_prompt")}
              multiple
              onCreate={handleCreateTag}
            />
          </div>

          {/* Stock & Status Row */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                {t("availability")}
              </label>
              <div className="flex items-center gap-2 min-h-11">
                <input
                  type="checkbox"
                  id="inStock"
                  checked={inStock}
                  onChange={(e) => setInStock(e.target.checked)}
                  className="rounded border-border bg-transparent text-primary focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="inStock" className="text-sm font-medium text-muted-foreground cursor-pointer">
                  {t("in_stock")}
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                {t("status")}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="Published">{t("published")}</option>
                <option value="Draft">{t("draft")}</option>
                <option value="Archived">{t("archived")}</option>
              </select>
            </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {selectedImages.map((img) => {
                const isCover = coverImage === img.mediaId;
                const mediaItem = mediaList.find(m => m.id === img.mediaId);
                const isPortrait = mediaItem?.orientation === "Portrait" || (mediaItem?.height && mediaItem?.width && mediaItem.height > mediaItem.width);
                const isLandscape = mediaItem?.orientation === "Landscape" || (mediaItem?.height && mediaItem?.width && mediaItem.width > mediaItem.height);

                return (
                  <div
                    key={img.mediaId}
                    className={`group relative aspect-square bg-muted rounded-lg overflow-hidden border-2 transition-all ${
                      isCover
                        ? "border-primary ring-2 ring-primary/25"
                        : "border-border"
                    }`}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="absolute"
                      style={{
                        left: "50%",
                        top: "50%",
                        width: isPortrait ? "100%" : (isLandscape ? "auto" : "100%"),
                        height: isLandscape ? "100%" : (isPortrait ? "auto" : "100%"),
                        minWidth: "100%",
                        minHeight: "100%",
                        transformOrigin: "center center",
                        transform: img.position 
                          ? `translate(-50%, -50%) translate(${img.position.x}px, ${img.position.y}px) scale(${img.position.zoom})` 
                          : 'translate(-50%, -50%) scale(1)'
                      }}
                    />
                    
                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCoverImage(img.mediaId);
                          if (img.position) {
                            setCoverPosition(img.position);
                          } else {
                            setCoverPosition(null);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold w-3/4 cursor-pointer ${
                          isCover ? "bg-primary text-primary-foreground" : "bg-white text-black hover:bg-gray-200"
                        }`}
                      >
                        {isCover ? t("cover") : t("set_cover")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveCropMediaId(img.mediaId)}
                        className="px-3 py-1.5 bg-white text-black hover:bg-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 justify-center w-3/4 cursor-pointer"
                      >
                        <Move size={12} />
                        {t("position")}
                      </button>
                    </div>

                    {isCover && (
                      <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                        {t("cover").toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Cover specific crop button (if needed specifically for cover) */}
          {coverImage && (
            <div className="pt-4 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setActiveCropMediaId("cover")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Move size={14} />
                {t("fine_tune_cover")}
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/dashboard"
            className="px-5 py-2.5 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors cursor-pointer"
          >
            {t("cancel")}
          </Link>

          <button
            type="submit"
            disabled={isSaving || !title || !categoryId || !collectionId}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                {t("saving")}
              </>
            ) : (
              <>
                <Save size={16} />
                {isEditMode ? t("save") : t("add_project")}
              </>
            )}
          </button>
        </div>
      </form>

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
