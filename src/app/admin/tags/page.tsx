"use client";

import { FormPanelHeader } from "@/components/shared/FormPanelHeader";
import { cn } from "@/utils/cn";
import { useRef, useState } from "react";
import { Plus, Edit, Save, X, Trash2, Loader2 } from "lucide-react";
import {
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
} from "@/store/api";
import { useTagsList } from "@/hooks/useTagsList";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { Input } from "@/components/ui/input";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { RowAction, RowActions } from "@/components/shared/RowAction";
import PageVirtualList from "@/components/shared/PageVirtualList";
import { useTranslation } from "@/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { tagSchema } from "@/common/validation/schemas";
import { scrollToEditForm } from "@/utils/scrollToEditForm";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { ApiMutationError, Tag } from "@/types";
import { BLOCK_HEADER_CLASS } from "@/utils/designTokens";

export default function AdminTags() {
  const { t, loc, locale } = useTranslation();

  const { tags, isLoading, isLoadingMore, loadMore, reload } = useTagsList("");
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTagObj, setActiveTagObj] = useState<Tag | null>(null);

  const resetForm = () => {
    setIsEditing(null);
    setIsFormOpen(false);
    setActiveTagObj(null);
    form.reset(defaultValues);
  };

  const {
    isOpen: isDeleteOpen,
    targetId: deleteTargetId,
    handleDeleteClick,
    handleConfirmDelete,
    handleClose: handleDeleteClose,
  } = useDeleteConfirm(deleteTag, {
    onSuccess: () => {
      if (isEditing === deleteTargetId) {
        resetForm();
      }
      reload();
    },
    onError: (error) => console.error("Failed to delete tag", error),
    closeOnError: false,
  });

  const formBlockRef = useRef<HTMLDivElement>(null);

  const handleEdit = (tag: Tag) => {
    setIsEditing(tag.id);
    setIsFormOpen(true);
    scrollToEditForm(formBlockRef.current);
    setActiveTagObj(tag);
    form.reset({
      name: typeof tag.name === "string" ? { [locale]: tag.name } : tag.name || {},
    });
  };

  const onSubmit = async (values: z.infer<typeof tagSchema>) => {
    // The schema accepts a name when any locale has text; an emptied admin-locale name must not
    // overwrite the real one (see categories/page.tsx).
    if (!values.name?.[locale]?.trim()) {
      form.setError(`name.${locale}` as `name.${string}`, { type: "manual", message: "error_required_field" });
      return;
    }

    try {
      if (isEditing) {
        const existingName = activeTagObj?.name && typeof activeTagObj.name === "object" ? activeTagObj.name : {};
        await updateTag({
          id: isEditing,
          name: { ...existingName, ...values.name },
        }).unwrap();
      } else {
        await createTag(values).unwrap();
      }
      resetForm();
      reload(); // Reset to page 1 to fetch the latest
    } catch (error: unknown) {
      const apiError = error as ApiMutationError;
      if (apiError?.data?.error?.details) {
        apiError.data.error.details.forEach((detail) => {
          form.setError(detail.field as any, { type: "server", message: detail.message });
        });
      }
      console.error("Failed to add tag", error);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-xl sm:text-[22px] lg:text-2xl font-bold tracking-tight text-foreground">{t("tags_manager")}</h1>
        <p className="text-xs text-muted-foreground">
          {t("tags_subtitle")}
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Tags List */}
        <div className="lg:col-span-8 order-2 bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50">
            <h2 className={BLOCK_HEADER_CLASS}>{t("all_tags")} ({tags.length})</h2>
          </div>
          <div>
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Loader2 className="animate-spin inline mr-2" size={16} />
                {t("loading_tags")}
              </div>
            ) : tags.length > 0 ? (
              <PageVirtualList
                items={tags}
                estimateSize={76}
                className="divide-y divide-border/45"
                onEndReached={loadMore}
                renderItem={(tag) => (
                  <div className="p-4 h-full flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                    <div className="flex flex-col gap-1 min-w-0 flex-1 overflow-hidden">
                      <span className="font-semibold text-[13px] sm:text-sm text-foreground truncate">
                        #{loc(tag.name)}
                      </span>
                    </div>

                    <RowActions>
                      <RowAction icon={Edit} title={t("rename_tag")} active={isEditing === tag.id} onClick={() => handleEdit(tag)} />
                      <RowAction icon={Trash2} tone="destructive" title={t("delete_tag")} disabled={isDeleting} onClick={() => handleDeleteClick(tag.id)} />
                    </RowActions>
                  </div>
                )}
              />
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">{t("no_tags")}</div>
            )}
            {isLoadingMore && (
              <div className="p-4 flex items-center justify-center text-xs text-muted-foreground border-t border-border bg-muted/5">
                <Loader2 className="animate-spin mr-2 animate-duration-1000" size={16} />
                {t("loading_more_tags")}
              </div>
            )}
          </div>
        </div>

        {/* Add / Edit Tag */}
        <div ref={formBlockRef} className="lg:col-span-4 order-1 bg-card rounded-xl border border-border overflow-hidden h-fit scroll-mt-4">
          <FormPanelHeader
            title={isEditing ? t("rename_tag") : t("add_new_tag")}
            isOpen={isFormOpen}
            onToggle={() => setIsFormOpen((open) => !open)}
            action={isEditing && (
                <button
                  onClick={resetForm}
                  className="text-xs sm:text-[13px] sm:font-medium sm:h-8 sm:px-3 sm:rounded-lg text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors sm:absolute sm:right-1 sm:top-1/2 sm:-translate-y-1/2"
                >
                  <X size={12} />
                  {t("cancel_action")}
                </button>
            )}
          />
          <div className={cn("p-5 space-y-4", !isFormOpen && "hidden", "lg:block")}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name={`name.${locale}` as any}
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className={BLOCK_HEADER_CLASS}>{t("tag_name")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        type="text"
                        placeholder={t("placeholder_vintage")}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-medium text-destructive" />
                  </FormItem>
                )}
              />

              <button
                type="submit"
                disabled={!form.formState.isValid || isCreating || isUpdating}
                className="w-full flex items-center justify-center gap-1.5 h-9 sm:h-10 px-4 bg-primary text-primary-foreground text-[13px] sm:text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer mt-4"
              >
                {isCreating || isUpdating ? <Loader2 className="animate-spin" size={16} /> : isEditing ? <Save size={16} /> : <Plus size={16} />}
                  {isEditing ? t("save") : t("create_tag")}
              </button>
            </form>
          </Form>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("tags")}
        message={t("delete_confirm_tag")}
        confirmText={t("delete") || "Delete"}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmDelete}
        onClose={handleDeleteClose}
        isLoading={isDeleting}
      />
    </div>
  );
}
