"use client";

import { useState } from "react";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { useGetPostsQuery, useDeletePostMutation } from "@/store/api";
import { Post } from "@/types";
import Link from "next/link";

export default function AdminDashboard() {
  const [search, setSearch] = useState("");
  const { data: response, isLoading } = useGetPostsQuery({ search: search || undefined });
  const [deletePost] = useDeletePostMutation();
  const posts = response?.data || [];

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      try {
        await deletePost(id).unwrap();
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your portfolio works and items.</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-sans text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity"
        >
          <Plus size={16} />
          Add Project
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
            placeholder="Search projects..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-transparent font-sans text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border/60 bg-muted/50">
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Availability</th>
              <th className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  Loading projects...
                </td>
              </tr>
            ) : posts.length > 0 ? (
              posts.map((post) => {
                const categoryObject = post.category && typeof post.category === "object" ? post.category : null;
                const rawCatTitle = categoryObject ? categoryObject.title : "";
                const categoryTitle = typeof rawCatTitle === "string" ? rawCatTitle : rawCatTitle?.ru || rawCatTitle?.en || "";
                const postTitle = typeof post.title === "string" ? post.title : post.title?.ru || post.title?.en || "";
                const postDesc = typeof post.description === "string" ? post.description : post.description?.ru || post.description?.en || "";
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
                        {post.in_stock ? "In Stock" : "On Request"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/projects/${post.id}`}
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
                  No projects found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
