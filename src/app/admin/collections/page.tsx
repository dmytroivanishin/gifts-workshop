"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Save, X, Trash2, Loader2, Star, Check } from "lucide-react";
import {
  useGetCollectionsQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
} from "@/store/api";
import { useTranslation } from "@/i18n";
import ConfirmModal from "@/components/shared/ConfirmModal";

export default function AdminCollections() {
  const { t, loc } = useTranslation();
  const { data: response, isLoading } = useGetCollectionsQuery();
  const [createCollection, { isLoading: isCreating }] = useCreateCollectionMutation();
  const [updateCollection, { isLoading: isUpdating }] = useUpdateCollectionMutation();
  const [deleteCollection, { isLoading: isDeleting }] = useDeleteCollectionMutation();

  const collections = response?.data || [];

  // Form State
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [isMain, setIsMain] = useState(false);

  const resetForm = () => {
    setIsEditing(null);
    setTitle("");
    setDescription("");
    setIsMain(false);
  };

  const handleEdit = (col: any) => {
    setIsEditing(col.id);
    setTitle(typeof col.title === "string" ? col.title : col.title?.ru || "");
    setDescription(typeof col.description === "string" ? col.description : col.description?.ru || "");
    setIsMain(col.main || false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: { ru: title.trim(), en: "" },
      description: { ru: description.trim(), en: "" },
      main: isMain,
    };

    try {
      if (isEditing) {
        await updateCollection({ id: isEditing, ...payload }).unwrap();
      } else {
        await createCollection(payload).unwrap();
      }
      resetForm();
    } catch (err) {
      console.error("Failed to save collection", err);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteCollection(deleteTargetId).unwrap();
      setIsDeleteOpen(false);
      if (isEditing === deleteTargetId) {
        resetForm();
      }
      setDeleteTargetId("");
    } catch (err) {
      console.error("Failed to delete collection", err);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("collections")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("manage_collections")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Collections List */}
        <div className="lg:col-span-7 bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold text-foreground">
              {t("collections")} ({collections.length})
            </h2>
          </div>
          <div className="divide-y divide-border/45">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Loader2 className="animate-spin inline mr-2" size={16} />
                {t("loading_collections")}
              </div>
            ) : collections.length > 0 ? (
              collections.map((col: any) => (
                <div
                  key={col.id}
                  className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {loc(col.title)}
                      </span>
                      {col.main && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DADFC6] text-[#5C6535] uppercase tracking-wider">
                          <Star size={10} className="fill-current" />
                          {t("main")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                      {loc(col.description) || t("no_description")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                      slug: {col.slug}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(col)}
                      className={`p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer ${
                        isEditing === col.id ? "bg-muted text-foreground" : ""
                      }`}
                      title={t("edit_collection")}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(col.id)}
                      disabled={isDeleting}
                      className="p-1.5 rounded-md hover:bg-muted hover:text-destructive transition-colors text-muted-foreground cursor-pointer disabled:opacity-50"
                      title={t("delete_collection")}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">{t("no_projects")}</div>
            )}
          </div>
        </div>

        {/* Add / Edit Form */}
        <div className="lg:col-span-5 bg-card rounded-xl border border-border/40 p-5 h-fit space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-semibold text-sm text-foreground">
              {isEditing ? t("edit_collection") : t("add_collection")}
            </h3>
            {isEditing && (
              <button
                onClick={resetForm}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
              >
                <X size={12} />
                {t("cancel_action")}
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("title")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("placeholder_collection_title")}
                className="w-full px-3.5 py-2 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("description")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("placeholder_collection_desc")}
                rows={4}
                className="w-full px-3.5 py-2 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Main flag checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isMain"
                checked={isMain}
                onChange={(e) => setIsMain(e.target.checked)}
                className="rounded border-border bg-transparent text-primary focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <label
                htmlFor="isMain"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none"
              >
                {t("main_collection")}
              </label>
            </div>

            <button
              type="submit"
              disabled={isCreating || isUpdating || !title.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {isCreating || isUpdating ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  {t("saving")}
                </>
              ) : (
                <>
                  {isEditing ? <Save size={16} /> : <Plus size={16} />}
                  {isEditing ? t("save") : t("add_collection")}
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("collections")}
        message={t("delete_confirm_collection")}
        confirmText={t("delete") || "Delete"}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
}
