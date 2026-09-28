"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Save, X, Trash2, Loader2 } from "lucide-react";
import {
  useGetTagsQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
} from "@/store/api";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { useTranslation } from "@/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { tagSchema } from "@/common/validation/schemas";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

export default function AdminTags() {
  const { t, loc, locale } = useTranslation();
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<any[]>([]);

  const { data: tagsResponse, isLoading, isFetching } = useGetTagsQuery({ page, limit: 15 });
  const [createTag, { isLoading: isCreating }] = useCreateTagMutation();
  const [updateTag, { isLoading: isUpdating }] = useUpdateTagMutation();
  const [deleteTag, { isLoading: isDeleting }] = useDeleteTagMutation();

  const defaultValues = {
    name: {}
  };

  const form = useForm<z.infer<typeof tagSchema>>({
    resolver: zodResolver(tagSchema) as any,
    defaultValues,
    mode: "onChange"
  });

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [activeTagObj, setActiveTagObj] = useState<any>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [editTagName, setEditTagName] = useState("");

  const loaderRef = useRef<HTMLDivElement | null>(null);
  const hasMore = tagsResponse?.meta?.nextPage != null;

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

  const onSubmit = async (values: z.infer<typeof tagSchema>) => {
    try {
      await createTag(values).unwrap();
      form.reset(defaultValues);
      setPage(1); // Reset to page 1 to fetch the latest
    } catch (err: any) {
      if (err?.data?.error?.details) {
        err.data.error.details.forEach((detail: any) => {
          form.setError(detail.field as any, { type: "server", message: detail.message });
        });
      }
      console.error("Failed to add tag", err);
    }
  };

  const handleSave = async (id: string) => {
    if (!editTagName.trim()) return;
    try {
      const existingName = activeTagObj?.name && typeof activeTagObj.name === "object" ? activeTagObj.name : {};
      
      await updateTag({
        id,
        name: { ...existingName, [locale]: editTagName.trim() },
      }).unwrap();
      setIsEditing(null);
      setActiveTagObj(null);
      setPage(1); // Reset to reload updated list
    } catch (err) {
      console.error("Failed to save tag", err);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteTag(deleteTargetId).unwrap();
      setIsDeleteOpen(false);
      setDeleteTargetId("");
      setPage(1); // Reset to reload list
    } catch (err) {
      console.error("Failed to delete tag", err);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("tags_manager")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("tags_subtitle")}
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Tags List */}
        <div className="lg:col-span-8 order-2 bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold text-foreground">{t("all_tags")} ({tagsResponse?.meta?.totalItems || tags.length})</h2>
          </div>
          <div className="divide-y divide-border/45">
            {isLoading && page === 1 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Loader2 className="animate-spin inline mr-2" size={16} />
                {t("loading_tags")}
              </div>
            ) : tags.length > 0 ? (
              tags.map((tag: any) => (
                <div
                  key={tag.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0 hover:bg-muted/10 transition-colors"
                >
                  {isEditing === tag.id ? (
                    <div className="flex-1 w-full sm:mr-4">
                      <input
                        type="text"
                        value={editTagName}
                        onChange={(e) => setEditTagName(e.target.value)}
                        placeholder={t("tag_name_placeholder")}
                        className="w-full sm:max-w-[300px] px-3 py-2 sm:py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 w-full sm:w-auto overflow-hidden">
                      <span className="font-semibold text-sm text-foreground bg-secondary px-2.5 py-1 rounded-full border border-border/60 w-fit truncate max-w-full">
                        #{loc(tag.name)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                    {isEditing === tag.id ? (
                      <>
                        <button
                          onClick={() => handleSave(tag.id)}
                          disabled={isUpdating}
                          className="p-2 sm:p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                        >
                          <Save size={18} className="sm:w-4 sm:h-4 w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setIsEditing(null)}
                          className="p-2 sm:p-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                          <X size={18} className="sm:w-4 sm:h-4 w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setIsEditing(tag.id);
                            setActiveTagObj(tag);
                            const tagTitle = loc(tag.name);
                            setEditTagName(tagTitle);
                          }}
                          className="p-2 sm:p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                          title={t("rename_tag")}
                        >
                          <Edit size={18} className="sm:w-4 sm:h-4 w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(tag.id)}
                          disabled={isDeleting}
                          className="p-2 sm:p-1.5 rounded-md hover:bg-muted hover:text-destructive transition-colors text-muted-foreground cursor-pointer disabled:opacity-50"
                          title={t("delete_tag")}
                        >
                          <Trash2 size={18} className="sm:w-4 sm:h-4 w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">{t("no_tags")}</div>
            )}
            {tags.length > 0 && hasMore && (
              <div ref={loaderRef} className="p-4 flex items-center justify-center text-sm text-muted-foreground border-t border-border/45 bg-muted/5">
                <Loader2 className="animate-spin mr-2 animate-duration-1000" size={16} />
                {t("loading_more_tags")}
              </div>
            )}
          </div>
        </div>

        {/* Add New Tag */}
        <div className="lg:col-span-4 order-1 bg-card rounded-xl border border-border/40 p-5 h-fit space-y-4 shadow-sm">
          <h3 className="font-semibold text-sm text-foreground border-b pb-2">{t("add_new_tag")}</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name={`name.${locale}` as any}
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("tag_name")}</FormLabel>
                    <FormControl>
                      <input
                        {...field}
                        value={field.value || ""}
                        type="text"
                        placeholder={t("placeholder_vintage")}
                        className={`w-full px-3.5 py-2 rounded-lg border bg-transparent text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${form.formState.errors.name ? "border-destructive text-destructive focus:border-destructive focus:ring-destructive/20" : "border-border"}`}
                      />
                    </FormControl>
                    <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                  </FormItem>
                )}
              />

              <button
                type="submit"
                disabled={!form.formState.isValid || isCreating}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer mt-4"
              >
                <Plus size={16} />
                {t("create_tag")}
              </button>
            </form>
          </Form>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("tags")}
        message={t("delete_confirm_tag")}
        confirmText={t("delete") || "Delete"}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
}
