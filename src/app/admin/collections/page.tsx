"use client";

import { useRef, useState } from "react";
import { Plus, Edit, Save, X, Trash2, Loader2, Star } from "lucide-react";
import {
  useGetCollectionsQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
} from "@/store/api";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { RowAction, RowActions } from "@/components/shared/RowAction";
import PageVirtualList from "@/components/shared/PageVirtualList";
import { useTranslation } from "@/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collectionSchema } from "@/common/validation/schemas";
import { scrollToEditForm } from "@/utils/scrollToEditForm";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { ApiMutationError, Collection } from "@/types";
import { BLOCK_HEADER_CLASS } from "@/utils/designTokens";

export default function AdminCollections() {
  const { t, loc, locale } = useTranslation();
  const { data: response, isLoading } = useGetCollectionsQuery();
  const [createCollection, { isLoading: isCreating }] = useCreateCollectionMutation();
  const [updateCollection, { isLoading: isUpdating }] = useUpdateCollectionMutation();
  const [deleteCollection, { isLoading: isDeleting }] = useDeleteCollectionMutation();

  const collections = response?.data || [];

  // Form State
  const defaultValues = {
    title: {},
    description: {},
    main: false,
  };

  const form = useForm<z.infer<typeof collectionSchema>>({
    resolver: zodResolver(collectionSchema) as any,
    defaultValues,
    mode: "onChange"
  });

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [activeCollectionObj, setActiveCollectionObj] = useState<Collection | null>(null);

  const resetForm = () => {
    setIsEditing(null);
    setActiveCollectionObj(null);
    form.reset(defaultValues);
  };

  const {
    isOpen: isDeleteOpen,
    targetId: deleteTargetId,
    handleDeleteClick,
    handleConfirmDelete,
    handleClose: handleDeleteClose,
  } = useDeleteConfirm(deleteCollection, {
    onSuccess: () => {
      if (isEditing === deleteTargetId) {
        resetForm();
      }
    },
    onError: (error) => console.error("Failed to delete collection", error),
    closeOnError: false,
  });

  const formBlockRef = useRef<HTMLDivElement>(null);

  const handleEdit = (collection: Collection) => {
    setIsEditing(collection.id);
    scrollToEditForm(formBlockRef.current);
    setActiveCollectionObj(collection);
    form.reset({
      title: typeof collection.title === "string" ? { [locale]: collection.title } : collection.title || {},
      description: typeof collection.description === "string" ? { [locale]: collection.description } : collection.description || {},
      main: collection.main || false,
    });
  };

  const onSubmit = async (values: z.infer<typeof collectionSchema>) => {
    // The schema accepts a title when any locale has text. On edit the form also carries the other
    // locale's text, so an emptied admin-locale name would pass and overwrite the real title.
    if (!values.title?.[locale]?.trim()) {
      form.setError(`title.${locale}` as `title.${string}`, { type: "manual", message: "error_required_field" });
      return;
    }

    try {
      if (isEditing) {
        const existingTitle = activeCollectionObj?.title && typeof activeCollectionObj.title === "object" ? activeCollectionObj.title : {};
        const existingDesc = activeCollectionObj?.description && typeof activeCollectionObj.description === "object" ? activeCollectionObj.description : {};

        await updateCollection({ 
          id: isEditing, 
          ...values,
          title: { ...existingTitle, ...values.title },
          description: { ...existingDesc, ...values.description },
        }).unwrap();
      } else {
        await createCollection(values).unwrap();
      }
      resetForm();
    } catch (error: unknown) {
      const apiError = error as ApiMutationError;
      if (apiError?.data?.error?.details) {
        apiError.data.error.details.forEach((detail) => {
          form.setError(detail.field as any, { type: "server", message: detail.message });
        });
      }
      console.error("Failed to save collection", error);
    }
  };


  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-xl sm:text-[22px] lg:text-2xl font-bold tracking-tight text-foreground">{t("collections")}</h1>
        <p className="text-xs text-muted-foreground">
          {t("manage_collections")}
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Collections List */}
        <div className="lg:col-span-8 order-2 bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50">
            <h2 className={BLOCK_HEADER_CLASS}>
              {t("collections")} ({collections.length})
            </h2>
          </div>
          <div>
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Loader2 className="animate-spin inline mr-2" size={16} />
                {t("loading_collections")}
              </div>
            ) : collections.length > 0 ? (
              <PageVirtualList
                items={collections}
                estimateSize={100}
                className="divide-y divide-border/45"
                renderItem={(collection) => (
                <div
                  className="p-4 h-full flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-0 sm:pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[13px] sm:text-sm text-foreground truncate">
                        {loc(collection.title)}
                      </span>
                      {collection.main && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-lime-active text-lime-text uppercase tracking-wider">
                          <Star size={10} className="fill-current" />
                          {t("main")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                      {loc(collection.description) || t("no_description")}
                    </p>
                    <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">
                      slug: {collection.slug}
                    </p>
                  </div>

                  <RowActions>
                    <RowAction icon={Edit} title={t("edit_collection")} active={isEditing === collection.id} onClick={() => handleEdit(collection)} />
                    <RowAction icon={Trash2} tone="destructive" title={t("delete_collection")} disabled={isDeleting} onClick={() => handleDeleteClick(collection.id)} />
                  </RowActions>
                </div>
                )}
              />
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">{t("no_posts")}</div>
            )}
          </div>
        </div>

        {/* Add / Edit Form */}
        <div ref={formBlockRef} className="lg:col-span-4 order-1 bg-card rounded-xl border border-border overflow-hidden h-fit scroll-mt-4">
          <div className="relative p-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <h3 className={BLOCK_HEADER_CLASS}>
              {isEditing ? t("edit_collection") : t("add_collection")}
            </h3>
            {isEditing && (
              <button
                onClick={resetForm}
                className="text-xs sm:text-[13px] sm:font-medium sm:h-8 sm:px-3 sm:rounded-lg text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors sm:absolute sm:right-1 sm:top-1/2 sm:-translate-y-1/2"
              >
                <X size={12} />
                {t("cancel_action")}
              </button>
            )}
          </div>

          <div className="p-5 space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              
              {/* Title */}
              <FormField
                control={form.control}
                name={`title.${locale}` as any}
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className={BLOCK_HEADER_CLASS}>
                      {t("title")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        type="text"
                        placeholder={t("placeholder_collection_title")}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-medium text-destructive" />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name={`description.${locale}` as any}
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className={BLOCK_HEADER_CLASS}>
                      {t("description")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder={t("placeholder_collection_desc")}
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage className="text-xs font-medium text-destructive" />
                  </FormItem>
                )}
              />

              {/* Main flag checkbox */}
              <FormField
                control={form.control}
                name="main"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                    <FormControl>
                      <Checkbox
                        id="mainCollectionCheckbox"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel htmlFor="mainCollectionCheckbox" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">
                        {t("main_collection")}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <button
                type="submit"
                disabled={!form.formState.isValid || isCreating || isUpdating}
                className="w-full flex items-center justify-center gap-1.5 h-9 sm:h-10 px-4 bg-primary text-primary-foreground text-[13px] sm:text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer mt-4"
              >
                {isCreating || isUpdating ? <Loader2 className="animate-spin" size={16} /> : isEditing ? <Save size={16} /> : <Plus size={16} />}
                  {isEditing ? t("save") : t("add_collection")}
              </button>
            </form>
          </Form>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("collections")}
        message={t("delete_confirm_collection")}
        confirmText={t("delete") || "Delete"}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmDelete}
        onClose={handleDeleteClose}
        isLoading={isDeleting}
      />
    </div>
  );
}
