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
} from "@/store/api";
import ImageCropModal from "@/components/shared/ImageCropModal";
import MediaPickerModal from "@/components/shared/MediaPickerModal";
import Combobox from "@/components/ui/combobox";

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

  const categories = categoriesResponse?.data || [];
  const allTags = tagsResponse?.data || [];

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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

  // Populate form if in Edit Mode
  useEffect(() => {
    if (isEditMode && postResponse?.data) {
      const post = postResponse.data;
      
      setTitle(typeof post.title === "string" ? post.title : post.title?.ru || "");
      setDescription(typeof post.description === "string" ? post.description : post.description?.ru || "");
      
      const cat = typeof post.category !== "string" ? post.category?.id || "" : post.category;
      setCategoryId(cat);
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
        const tagNames = post.tags.map((t: any) => typeof t === "string" ? t : t.name);
        setSelectedTags(tagNames);
      }
    }
  }, [isEditMode, postResponse]);

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
    } else if (activeCropMediaId) {
      setSelectedImages(prev => prev.map(m => 
        m.mediaId === activeCropMediaId ? { ...m, position: pos } : m
      ));
    }
    setActiveCropMediaId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !categoryId) return;

    // Build media array
    const media = selectedImages.map((img, index) => ({
      id: `m-${Date.now()}-${index}`,
      order: index + 1,
      media: {
        id: img.mediaId,
        thumbnailUrl: img.url,
        originalUrl: img.url,
      },
      position: img.position || undefined,
    }));

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

    const existingEnTitle = postResponse?.data?.title && typeof postResponse.data.title === "object"
      ? postResponse.data.title.en
      : "";
    const existingEnDesc = postResponse?.data?.description && typeof postResponse.data.description === "object"
      ? postResponse.data.description.en
      : "";

    const payload = {
      title: { ru: title, en: existingEnTitle || "" },
      description: { ru: description, en: existingEnDesc || "" },
      category: categoryId,
      in_stock: inStock,
      status: status as any,
      media,
      poster,
      tags: selectedTags,
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
  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: typeof cat.title === "string" ? cat.title : cat.title?.ru || "",
  }));

  const tagOptions = [...allTags]
    .sort((a, b) => {
      const aMatches = categoryId && a.categories?.includes(categoryId) ? 1 : 0;
      const bMatches = categoryId && b.categories?.includes(categoryId) ? 1 : 0;
      if (aMatches !== bMatches) return bMatches - aMatches;
      return a.name.localeCompare(b.name);
    })
    .map((tag) => ({
      value: tag.name,
      label: categoryId && tag.categories?.includes(categoryId) ? `${tag.name} (★)` : tag.name,
    }));

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
              {isEditMode ? "Edit Project" : "Create New Project"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEditMode ? "Update details of your existing work." : "Add a new handmade work to your portfolio catalog."}
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
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title..."
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
              Category
            </label>
            <Combobox
              options={categoryOptions}
              value={categoryId}
              onChange={(val) => setCategoryId(val)}
              placeholder="Select category..."
              searchPlaceholder="Search categories..."
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project description..."
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
          </div>

          {/* Tags Combobox with Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
              Tags
            </label>
            <Combobox
              options={tagOptions}
              value={selectedTags}
              onChange={(val) => setSelectedTags(val)}
              placeholder="Select tags..."
              searchPlaceholder="Search or type new tag..."
              allowCreate
              createLabel='Add new tag "{search}"'
              multiple
            />
          </div>

          {/* Stock & Status Row */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                Availability
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
                  In Stock (В наличии)
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Media Selector with crop positioning */}
        <div className="bg-card rounded-xl border border-border/40 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <ImageIcon size={16} />
              <span>Project Gallery & Media</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMediaPickerOpen(true)}
              className="text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Add Media
            </button>
          </div>

          {selectedImages.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-border rounded-xl">
              <p className="text-sm text-muted-foreground">No media selected. Click Add Media to select from library.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {selectedImages.map((img) => {
                const isCover = coverImage === img.mediaId;

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
                      className="w-full h-full object-cover"
                      style={{
                        transform: img.position ? `scale(${img.position.zoom})` : 'scale(1)',
                        objectPosition: img.position ? `${img.position.x}px ${img.position.y}px` : 'center'
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold w-3/4 ${
                          isCover ? "bg-primary text-primary-foreground" : "bg-white text-black hover:bg-gray-200"
                        }`}
                      >
                        {isCover ? "Cover" : "Set Cover"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveCropMediaId(img.mediaId)}
                        className="px-3 py-1.5 bg-white text-black hover:bg-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 justify-center w-3/4"
                      >
                        <Move size={12} />
                        Position
                      </button>
                    </div>

                    {isCover && (
                      <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                        COVER
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                <Move size={14} />
                Fine-tune Cover Crop
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
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSaving || !title || !categoryId}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                {isEditMode ? "Update Project" : "Save Project"}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modals */}
      {activeCropMediaId && (
        <ImageCropModal
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
