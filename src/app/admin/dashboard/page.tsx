"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Search, Edit, Trash2, Eye, Loader2 } from "lucide-react";
import { useGetPostsQuery, useDeletePostMutation } from "@/store/api";
import { Post } from "@/types";
import Link from "next/link";
import { useTranslation } from "@/i18n";

export default function AdminDashboard() {
  const { t, loc } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const { data: response, isLoading, isFetching } = useGetPostsQuery({
    search: search || undefined,
    page,
    limit: 10,
    populate: "category,poster",
  });
  const [deletePost] = useDeletePostMutation();

  const loaderRef = useRef<HTMLTableRowElement | null>(null);

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
          const newPosts = response.data.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...newPosts];
        });
      }
      setHasMore(response.meta?.nextPage !== null);
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

  const handleDelete = async (id: string) => {
    if (confirm(t("delete_confirm"))) {
      try {
        await deletePost(id).unwrap();
        setPage(1); // Reset to page 1 to reload
      } catch (err) {
        console.error("Failed to delete project", err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("projects_manager")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin_panel")}</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-sans text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity"
        >
          <Plus size={16} />
          {t("add_project")}
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border/40">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search_projects")}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-transparent font-sans text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border/60 bg-muted/50">
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("title")}</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("category")}</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("status")}</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("availability")}</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading && page === 1 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  {t("loading_projects")}
                </td>
              </tr>
            ) : posts.length > 0 ? (
              posts.map((post) => {
                const categoryObject = post.category && typeof post.category === "object" ? post.category : null;
                const rawCatTitle = categoryObject ? categoryObject.title : "";
                const categoryTitle = loc(rawCatTitle);
                const postTitle = loc(post.title);
                const postDesc = loc(post.description);
                return (
                  <tr key={post.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {post.poster && (
                          <img
                            src={post.poster.thumbnailUrl}
                            alt=""
                            className="w-10 h-10 object-cover rounded-lg bg-muted"
                          />
                        )}
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        {post.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        post.in_stock 
                          ? "bg-olive-bg text-olive-text" 
                          : "bg-secondary text-secondary-foreground"
                      }`}>
                        {post.in_stock ? t("in_stock") : t("on_request")}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/projects/${post.slug || post.id}`}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="View"
                        >
                          <Eye size={16} />
                        </Link>
                        <Link
                          href={`/admin/projects/${post.id}`}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </Link>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  {t("no_projects")}
                </td>
              </tr>
            )}
            {posts.length > 0 && hasMore && (
              <tr ref={loaderRef}>
                <td colSpan={5} className="p-4 text-center text-sm text-muted-foreground bg-muted/5 border-t border-border/40">
                  <div className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2 animate-duration-1000" size={16} />
                    {t("loading_more_projects")}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
