"use client";

import { cn } from "@/utils/cn";
import { RowAction, RowActions } from "@/components/shared/RowAction";
import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Eye, Loader2 } from "lucide-react";
import { useGetPostsQuery, useDeletePostMutation, useBulkDeletePostsMutation } from "@/store/api";
import { useDispatch } from "react-redux";
import { addNotification } from "@/store/slices/notificationSlice";
import { Checkbox } from "@/components/ui/checkbox";
import { PopulatedPost } from "@/types";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import ConfirmModal from "@/components/shared/ConfirmModal";
import SearchInput from "@/components/shared/SearchInput";
import { MEDIA_PLACEHOLDER_DATA_URL, handleImageLoadError } from "@/utils/mediaPlaceholder";
import { SELECTION_COUNT_CLASS } from "@/utils/designTokens";
import { BUTTON_M_SIZE } from "@/utils/designTokens";

export default function AdminDashboard() {
  const { t, loc } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<PopulatedPost[]>([]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [rawSelectedIds, setRawSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const dispatch = useDispatch();

  const { data: response, isLoading, isFetching } = useGetPostsQuery({
    search: search || undefined,
    status: "all",
    page,
    limit: 10,
  });
  const [deletePost, { isLoading: isDeleting }] = useDeletePostMutation();
  const [bulkDeletePosts, { isLoading: isBulkDeleting }] = useBulkDeletePostsMutation();

  const loaderRef = useRef<HTMLDivElement | null>(null);
  const hasMore = response?.meta?.nextPage != null;

  // Reset page on search input changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Sync loaded page chunk to posts list
  useEffect(() => {
    if (response?.data) {
      if (page === 1) {
        setPosts(response.data);
      } else {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((post) => post.id));
          const newPosts = response.data.filter((post) => !existingIds.has(post.id));
          return [...prev, ...newPosts];
        });
      }
    }
  }, [response, page]);

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

  // The selection only ever covers rows that are on screen: ids of posts that are gone (deleted, or
  // dropped by a new search) are ignored, so a bulk delete can never touch a row the user cannot see.
  const visibleIds = new Set(posts.map((post) => post.id));
  const selectedIds = new Set(Array.from(rawSelectedIds).filter((id) => visibleIds.has(id)));
  const areAllSelected = posts.length > 0 && selectedIds.size === posts.length;

  const toggleSelected = (id: string) => {
    setRawSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelected = () => {
    setRawSelectedIds(areAllSelected ? new Set() : new Set(posts.map((post) => post.id)));
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    // Picks made under the old search must not come back when it is cleared.
    setRawSelectedIds(new Set());
  };

  const handleConfirmBulkDelete = async () => {
    try {
      await bulkDeletePosts(Array.from(selectedIds)).unwrap();
      dispatch(addNotification({ type: "success", messageKey: "posts_bulk_deleted" }));
      setRawSelectedIds(new Set());
      setPage(1);
    } catch (error: unknown) {
      // The notification middleware already toasts a rejected mutation.
      console.error("Failed to bulk-delete posts", error);
    } finally {
      setIsBulkDeleteOpen(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deletePost(deleteTargetId).unwrap();
      setIsDeleteOpen(false);
      setDeleteTargetId("");
      setPage(1); // Reset to page 1 to reload
    } catch (error) {
      console.error("Failed to delete post", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-[22px] lg:text-2xl font-bold tracking-tight text-foreground">{t("posts_manager")}</h1>
        </div>
        <Link
          href="/admin/posts/new"
          className="flex items-center justify-center gap-1.5 h-9 sm:h-10 px-4 w-full sm:w-auto bg-primary text-primary-foreground font-sans text-[13px] sm:text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity"
        >
          <Plus size={16} />
          {t("add_post")}
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/50 p-4 rounded-xl border border-border">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder={t("search_posts")}
          className="sm:flex-1 sm:max-w-sm"
        />

        {selectedIds.size > 0 && (
          <div data-test-id="bulk-action-bar" className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            <span className={SELECTION_COUNT_CLASS}>
              {t("items_selected")} {selectedIds.size}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRawSelectedIds(new Set())}
                className={cn(BUTTON_M_SIZE, "rounded-lg border border-border bg-card text-subtle-foreground hover:text-foreground hover:bg-muted font-medium transition-colors cursor-pointer")}
              >
                {t("cancel") || "Cancel"}
              </button>
              <button
                type="button"
                data-test-id="bulk-delete-button"
                title={t("delete_selected")}
                aria-label={t("delete_selected")}
                onClick={() => setIsBulkDeleteOpen(true)}
                className="p-2 rounded-lg border border-destructive/20 hover:border-destructive bg-destructive/5 hover:bg-destructive text-destructive hover:text-white transition-all cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Posts List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading && page === 1 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">{t("loading_posts")}</div>
        ) : posts.length > 0 ? (
          <>
            {/* Desktop Table */}
            {/* lg, not md: with the 256px sidebar the table needs ~720px, so between 768 and ~960px it clipped the actions column; the cards below fit any width. */}
            <table className="hidden lg:table w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-14 py-4 pl-4 pr-0">
                    <Checkbox
                      data-test-id="posts-select-all"
                      checked={areAllSelected}
                      onCheckedChange={toggleAllSelected}
                      aria-label={t("select_all")}
                      title={t("select_all")}
                    />
                  </th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("title")}</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("category")}</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("status")}</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("availability")}</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/45">
                {posts.map((post) => {
                  const categoryObject = post.category && typeof post.category === "object" ? post.category : null;
                  const rawCatTitle = categoryObject ? categoryObject.title : "";
                  const categoryTitle = loc(rawCatTitle);
                  const postTitle = loc(post.title);
                  const postDesc = loc(post.description);
                  
                  const getStatusClasses = (status: string) => {
                    switch (status) {
                      case "Published": return "bg-lime-active text-lime-text";
                      case "Draft": return "bg-[#F9E4D3] text-[#904504]";
                      case "Archived": return "bg-olive-bg text-olive-text";
                      default: return "bg-secondary text-secondary-foreground";
                    }
                  };
                  const getStockClasses = (inStock: boolean) => {
                    return inStock ? "bg-lime-active text-lime-text" : "bg-olive-bg text-olive-text";
                  };

                  return (
                    <tr key={post.id} className={`transition-colors ${selectedIds.has(post.id) ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                      <td className="w-14 py-4 pl-4 pr-0">
                        <Checkbox
                          data-test-id={`post-select-${post.id}`}
                          checked={selectedIds.has(post.id)}
                          onCheckedChange={() => toggleSelected(post.id)}
                          aria-label={t("select")}
                          title={t("select")}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={post.poster?.thumbnailUrl || MEDIA_PLACEHOLDER_DATA_URL}
                            onError={handleImageLoadError}
                            alt=""
                            className="w-10 h-10 object-cover rounded-lg bg-muted"
                          />
                          <div>
                            <div className="font-semibold text-foreground text-sm">{postTitle}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-[250px]">
                              {postDesc}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{categoryTitle}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusClasses(post.status)}`}>
                          {t(post.status.toLowerCase())}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStockClasses(post.inStock)}`}>
                          {post.inStock ? t("in_stock") : t("on_request")}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <RowAction icon={Eye} title={t("view")} href={`/posts/${post.slug || post.id}`} external />
                          <RowAction icon={Edit} title={t("edit")} href={`/admin/posts/${post.id}`} />
                          <RowAction icon={Trash2} tone="destructive" title={t("delete")} onClick={() => handleDeleteClick(post.id)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-border/45">
              {posts.map((post) => {
                const categoryObject = post.category && typeof post.category === "object" ? post.category : null;
                const rawCatTitle = categoryObject ? categoryObject.title : "";
                const categoryTitle = loc(rawCatTitle);
                const postTitle = loc(post.title);
                const postDesc = loc(post.description);

                const getStatusClasses = (status: string) => {
                  switch (status) {
                    case "Published": return "bg-lime-active text-lime-text";
                    case "Draft": return "bg-[#F9E4D3] text-[#904504]";
                    case "Archived": return "bg-olive-bg text-olive-text";
                    default: return "bg-secondary text-secondary-foreground";
                  }
                };
                const getStockClasses = (inStock: boolean) => {
                  return inStock ? "bg-lime-active text-lime-text" : "bg-olive-bg text-olive-text";
                };

                return (
                  <div
                    key={`mobile-${post.id}`}
                    className={`p-4 space-y-4 transition-colors ${selectedIds.has(post.id) ? "bg-primary/5" : "hover:bg-muted/10"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Checkbox
                        data-test-id={`post-select-${post.id}`}
                        checked={selectedIds.has(post.id)}
                        onCheckedChange={() => toggleSelected(post.id)}
                        aria-label={t("select")}
                        title={t("select")}
                      />
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusClasses(post.status)}`}>
                          {t(post.status.toLowerCase())}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getStockClasses(post.inStock)}`}>
                          {post.inStock ? t("in_stock") : t("on_request")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <img
                        src={post.poster?.thumbnailUrl || MEDIA_PLACEHOLDER_DATA_URL}
                        onError={handleImageLoadError}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg bg-muted flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-[13px] sm:text-sm truncate">{postTitle}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {postDesc}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1.5">
                          {categoryTitle}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      <RowActions>
                        <RowAction icon={Eye} title={t("view")} href={`/posts/${post.slug || post.id}`} external />
                        <RowAction icon={Edit} title={t("edit")} href={`/admin/posts/${post.id}`} />
                        <RowAction icon={Trash2} tone="destructive" title={t("delete")} onClick={() => handleDeleteClick(post.id)} />
                      </RowActions>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {t("no_posts")}
          </div>
        )}
        
        {/* Unified Loader */}
        {posts.length > 0 && hasMore && (
          <div ref={loaderRef} className="p-4 text-center text-xs text-muted-foreground bg-muted/5 border-t border-border flex items-center justify-center">
            <Loader2 className="animate-spin mr-2 animate-duration-1000" size={16} />
            {t("loading_more_posts")}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("posts")}
        message={t("delete_confirm")}
        confirmText={t("delete") || "Delete"}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={isBulkDeleteOpen}
        title={t("posts")}
        message={`${t("items_selected")} ${selectedIds.size}. ${t("confirm_bulk_delete_posts")}`}
        confirmText={t("delete_selected")}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmBulkDelete}
        onClose={() => setIsBulkDeleteOpen(false)}
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
