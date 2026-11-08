"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Eye, Loader2 } from "lucide-react";
import { useGetPostsQuery, useDeletePostMutation } from "@/store/api";
import { PopulatedPost } from "@/types";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import ConfirmModal from "@/components/shared/ConfirmModal";
import SearchInput from "@/components/shared/SearchInput";
import { MEDIA_PLACEHOLDER_DATA_URL, handleImageLoadError } from "@/utils/mediaPlaceholder";

export default function AdminDashboard() {
  const { t, loc } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<PopulatedPost[]>([]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState("");

  const { data: response, isLoading, isFetching } = useGetPostsQuery({
    search: search || undefined,
    status: "all",
    page,
    limit: 10,
  });
  const [deletePost, { isLoading: isDeleting }] = useDeletePostMutation();

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
          const existingIds = new Set(prev.map((p) => p.id));
          const newPosts = response.data.filter((p) => !existingIds.has(p.id));
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
    } catch (err) {
      console.error("Failed to delete post", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("posts_manager")}</h1>
        </div>
        <Link
          href="/admin/posts/new"
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 w-full sm:w-auto bg-primary text-primary-foreground font-sans text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity"
        >
          <Plus size={16} />
          {t("add_post")}
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/50 p-4 rounded-xl border border-border">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("search_posts")}
          className="sm:flex-1 sm:max-w-sm"
        />
      </div>

      {/* Posts List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading && page === 1 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("loading_posts")}</div>
        ) : posts.length > 0 ? (
          <>
            {/* Desktop Table */}
            <table className="hidden md:table w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("title")}</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("category")}</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("status")}</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("availability")}</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {posts.map((post) => {
                  const categoryObject = post.category && typeof post.category === "object" ? post.category : null;
                  const rawCatTitle = categoryObject ? categoryObject.title : "";
                  const categoryTitle = loc(rawCatTitle);
                  const postTitle = loc(post.title);
                  const postDesc = loc(post.description);
                  
                  const getStatusClasses = (status: string) => {
                    switch (status) {
                      case "Published": return "bg-[#DADFC6] text-[#5C6535]";
                      case "Draft": return "bg-[#F9E4D3] text-[#904504]";
                      case "Archived": return "bg-[#E7E7E5] text-[#504E47]";
                      default: return "bg-secondary text-secondary-foreground";
                    }
                  };
                  const getStockClasses = (inStock: boolean) => {
                    return inStock ? "bg-[#DADFC6] text-[#5C6535]" : "bg-[#E7E7E5] text-[#504E47]";
                  };

                  return (
                    <tr key={post.id} className="hover:bg-muted/30 transition-colors">
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusClasses(post.status)}`}>
                          {t(post.status.toLowerCase())}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStockClasses(post.inStock)}`}>
                          {post.inStock ? t("in_stock") : t("on_request")}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/posts/${post.slug || post.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-subtle-foreground hover:text-foreground"
                            title={t("view")}
                          >
                            <Eye size={16} />
                          </Link>
                          <Link
                            href={`/admin/posts/${post.id}`}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-subtle-foreground hover:text-foreground flex items-center justify-center"
                            title={t("edit")}
                          >
                            <Edit size={16} />
                          </Link>
                          <button
                            onClick={() => handleDeleteClick(post.id)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-subtle-foreground hover:text-destructive cursor-pointer"
                            title={t("delete")}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border/60">
              {posts.map((post) => {
                const categoryObject = post.category && typeof post.category === "object" ? post.category : null;
                const rawCatTitle = categoryObject ? categoryObject.title : "";
                const categoryTitle = loc(rawCatTitle);
                const postTitle = loc(post.title);
                const postDesc = loc(post.description);

                const getStatusClasses = (status: string) => {
                  switch (status) {
                    case "Published": return "bg-[#DADFC6] text-[#5C6535]";
                    case "Draft": return "bg-[#F9E4D3] text-[#904504]";
                    case "Archived": return "bg-[#E7E7E5] text-[#504E47]";
                    default: return "bg-secondary text-secondary-foreground";
                  }
                };
                const getStockClasses = (inStock: boolean) => {
                  return inStock ? "bg-[#DADFC6] text-[#5C6535]" : "bg-[#E7E7E5] text-[#504E47]";
                };

                return (
                  <div key={`mobile-${post.id}`} className="p-4 space-y-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-start gap-3">
                      <img
                        src={post.poster?.thumbnailUrl || MEDIA_PLACEHOLDER_DATA_URL}
                        onError={handleImageLoadError}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg bg-muted flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-sm truncate">{postTitle}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {postDesc}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1.5">
                          {categoryTitle}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusClasses(post.status)}`}>
                          {t(post.status.toLowerCase())}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getStockClasses(post.inStock)}`}>
                          {post.inStock ? t("in_stock") : t("on_request")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/posts/${post.slug || post.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-md hover:bg-muted transition-colors text-subtle-foreground hover:text-foreground"
                          title={t("view")}
                        >
                          <Eye size={18} />
                        </Link>
                        <Link
                          href={`/admin/posts/${post.id}`}
                          className="p-2 rounded-md hover:bg-muted transition-colors text-subtle-foreground hover:text-foreground"
                          title={t("edit")}
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          onClick={() => handleDeleteClick(post.id)}
                          className="p-2 rounded-md hover:bg-muted transition-colors text-subtle-foreground hover:text-destructive cursor-pointer"
                          title={t("delete")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t("no_posts")}
          </div>
        )}
        
        {/* Unified Loader */}
        {posts.length > 0 && hasMore && (
          <div ref={loaderRef} className="p-4 text-center text-sm text-muted-foreground bg-muted/5 border-t border-border flex items-center justify-center">
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
    </div>
  );
}
