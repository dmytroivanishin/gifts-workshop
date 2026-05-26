"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Save, X, Trash2, Loader2 } from "lucide-react";
import {
  useGetTagsQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
} from "@/store/api";

export default function AdminTags() {
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const { data: tagsResponse, isLoading, isFetching } = useGetTagsQuery({ page, limit: 15 });
  const [createTag, { isLoading: isCreating }] = useCreateTagMutation();
  const [updateTag, { isLoading: isUpdating }] = useUpdateTagMutation();
  const [deleteTag, { isLoading: isDeleting }] = useDeleteTagMutation();

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [tagName, setTagName] = useState("");
  const [editTagName, setEditTagName] = useState("");

  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Sync loaded page chunk to tags list
  useEffect(() => {
    if (tagsResponse?.data) {
      if (page === 1) {
        setTags(tagsResponse.data);
      } else {
        setTags((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newTags = tagsResponse.data.filter((t: any) => !existingIds.has(t.id));
          return [...prev, ...newTags];
        });
      }
      setHasMore(tagsResponse.meta?.nextPage !== null);
    }
  }, [tagsResponse, page]);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;

    try {
      await createTag({ title: { ru: tagName.trim(), en: "" } }).unwrap();
      setTagName("");
      setPage(1); // Reset to page 1 to fetch the latest
    } catch (err) {
      console.error("Failed to add tag", err);
    }
  };

  const handleSave = async (id: string) => {
    if (!editTagName.trim()) return;
    try {
      await updateTag({
        id,
        title: { ru: editTagName.trim(), en: "" },
      }).unwrap();
      setIsEditing(null);
      setPage(1); // Reset to reload updated list
    } catch (err) {
      console.error("Failed to save tag", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tag? It will be removed from all projects.")) return;
    try {
      await deleteTag(id).unwrap();
      setPage(1); // Reset to reload list
    } catch (err) {
      console.error("Failed to delete tag", err);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Tags Manager</h1>
        <p className="text-sm text-muted-foreground">
          View all tags in use, rename them, or delete them globally from all projects.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Tags List */}
        <div className="lg:col-span-8 bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold text-foreground">All Tags ({tagsResponse?.meta?.totalItems || tags.length})</h2>
          </div>
          <div className="divide-y divide-border/45">
            {isLoading && page === 1 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Loader2 className="animate-spin inline mr-2" size={16} />
                Loading tags...
              </div>
            ) : tags.length > 0 ? (
              tags.map((tag: any) => (
                <div
                  key={tag.id}
                  className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
                >
                  {isEditing === tag.id ? (
                    <div className="flex-1 mr-4">
                      <input
                        type="text"
                        value={editTagName}
                        onChange={(e) => setEditTagName(e.target.value)}
                        placeholder="Tag name..."
                        className="w-full max-w-[300px] px-3 py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-sm text-foreground bg-secondary px-2.5 py-1 rounded-full border border-border/60 w-fit">
                        #{typeof tag.title === "string" ? tag.title : tag.title?.ru || tag.title?.en || ""}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 ml-4">
                    {isEditing === tag.id ? (
                      <>
                        <button
                          onClick={() => handleSave(tag.id)}
                          disabled={isUpdating}
                          className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => setIsEditing(null)}
                          className="p-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setIsEditing(tag.id);
                            const tagTitle = typeof tag.title === "string" ? tag.title : tag.title?.ru || tag.title?.en || "";
                            setEditTagName(tagTitle);
                          }}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Rename Tag"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(tag.id)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-md hover:bg-muted hover:text-destructive transition-colors text-muted-foreground cursor-pointer disabled:opacity-50"
                          title="Delete Tag"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">No tags found.</div>
            )}
            {tags.length > 0 && hasMore && (
              <div ref={loaderRef} className="p-4 flex items-center justify-center text-sm text-muted-foreground border-t border-border/45 bg-muted/5">
                <Loader2 className="animate-spin mr-2 animate-duration-1000" size={16} />
                Loading more tags...
              </div>
            )}
          </div>
        </div>

        {/* Add New Tag */}
        <div className="lg:col-span-4 bg-card rounded-xl border border-border/40 p-5 h-fit space-y-4 shadow-sm">
          <h3 className="font-semibold text-sm text-foreground border-b pb-2">Add New Tag</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tag Name</label>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. vintage"
                className="w-full px-3.5 py-2 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              <Plus size={16} />
              Create Tag
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
