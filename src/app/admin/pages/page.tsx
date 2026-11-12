"use client";

import { useEffect, useRef, useState } from "react";
import { scrollToEditForm } from "@/utils/scrollToEditForm";
import { Plus, Edit, Save, X, Trash2, Loader2, Eye } from "lucide-react";
import {
  useGetPagesQuery,
  useCreatePageMutation,
  useUpdatePageMutation,
  useDeletePageMutation,
  useGenerateSlugMutation,
} from "@/store/api";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { RowAction, RowActions } from "@/components/shared/RowAction";
import { useTranslation } from "@/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { pageSchema } from "@/common/validation/schemas";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { ApiMutationError, Page } from "@/types";
import { BLOCK_HEADER_CLASS } from "@/utils/designTokens";

export default function AdminPages() {
  const { t, loc, locale } = useTranslation();

  const { data: pagesRes, isLoading } = useGetPagesQuery();
  const pages = pagesRes?.data ?? [];
  const [createPage, { isLoading: isCreating }] = useCreatePageMutation();
  const [updatePage, { isLoading: isUpdating }] = useUpdatePageMutation();
  const [deletePage, { isLoading: isDeleting }] = useDeletePageMutation();
  const [generateSlug] = useGenerateSlugMutation();

  const defaultValues = { title: {}, description: {}, slug: "", showInMenu: true };

  const form = useForm<z.infer<typeof pageSchema>>({
    resolver: zodResolver(pageSchema) as any,
    defaultValues,
    mode: "onChange",
  });

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<Page | null>(null);

  // The address is filled in from the title while the page is new, but once someone types in the
  // address field by hand it is theirs, and an existing page keeps its URL when its title changes.
  const [slugTouched, setSlugTouched] = useState(false);
  const slugRequestId = useRef(0);

  const resetForm = () => {
    setIsEditing(null);
    setActivePage(null);
    setSlugTouched(false);
    form.reset(defaultValues);
  };

  const titleText = form.watch(`title.${locale}` as any) as string | undefined;
  useEffect(() => {
    if (isEditing || slugTouched) return;
    const text = (titleText ?? "").trim();
    // Wait for a pause in typing: the slug is built through a translation service, so a request
    // per keystroke would hammer it.
    const timer = setTimeout(async () => {
      const requestId = ++slugRequestId.current;
      if (!text) {
        form.setValue("slug", "", { shouldValidate: true });
        return;
      }
      try {
        const response = await generateSlug({ text }).unwrap();
        // A newer title (or a manual edit) may have superseded this answer while it was in flight.
        if (requestId === slugRequestId.current) {
          form.setValue("slug", response.data.slug, { shouldValidate: true });
        }
      } catch (error: unknown) {
        console.error("Failed to generate slug", error);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [titleText, isEditing, slugTouched, generateSlug, form]);

  const {
    isOpen: isDeleteOpen,
    targetId: deleteTargetId,
    handleDeleteClick,
    handleConfirmDelete,
    handleClose: handleDeleteClose,
  } = useDeleteConfirm(deletePage, {
    onSuccess: () => {
      if (isEditing === deleteTargetId) resetForm();
    },
    onError: (error) => console.error("Failed to delete page", error),
    closeOnError: false,
  });

  const formBlockRef = useRef<HTMLDivElement>(null);

  const handleEdit = (page: Page) => {
    setIsEditing(page.id);
    scrollToEditForm(formBlockRef.current);
    setActivePage(page);
    setSlugTouched(true);
    form.reset({
      title: page.title || {},
      description: page.description || {},
      slug: page.slug,
      showInMenu: page.showInMenu,
    });
  };

  const onSubmit = async (values: z.infer<typeof pageSchema>) => {
    // The schema accepts a title when any language has text; an emptied admin-language title must
    // not overwrite the real one on edit (see categories/page.tsx).
    if (!values.title?.[locale]?.trim()) {
      form.setError(`title.${locale}` as `title.${string}`, { type: "manual", message: "error_required_field" });
      return;
    }

    try {
      // An empty slug means "generate one from the title" on create and "keep the current one" on edit.
      const slug = values.slug || undefined;
      if (isEditing && activePage) {
        // The form edits only the admin's own language; the other languages (set in Translations)
        // are carried over untouched.
        await updatePage({
          id: isEditing,
          title: { ...activePage.title, ...values.title },
          description: { ...activePage.description, ...values.description },
          slug,
          showInMenu: values.showInMenu,
        }).unwrap();
      } else {
        await createPage({ ...values, slug }).unwrap();
      }
      resetForm();
    } catch (error: unknown) {
      const apiError = error as ApiMutationError;
      apiError?.data?.error?.details?.forEach((detail) => {
        form.setError(detail.field as any, { type: "server", message: detail.message });
      });
      console.error("Failed to save page", error);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-xl sm:text-[22px] lg:text-2xl font-bold tracking-tight text-foreground">{t("pages")}</h1>
        <p className="text-xs text-muted-foreground">{t("pages_subtitle")}</p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Pages list */}
        <div className="lg:col-span-8 order-2 bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50">
            <h2 className={BLOCK_HEADER_CLASS}>{t("all_pages")} ({pages.length})</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Loader2 className="animate-spin inline mr-2" size={16} />
              {t("loading_pages")}
            </div>
          ) : pages.length > 0 ? (
            <div className="divide-y divide-border/45">
              {pages.map((page) => (
                <div
                  key={page.id}
                  data-test-id={`page-row-${page.id}`}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex flex-col gap-1 w-full sm:w-auto overflow-hidden">
                    <span className="font-semibold text-[13px] sm:text-sm text-foreground truncate">{loc(page.title)}</span>
                    {!page.showInMenu && (
                      <span className="text-xs text-muted-foreground truncate">{t("page_hidden_from_menu")}</span>
                    )}
                  </div>
                  <RowActions>
                    <RowAction icon={Edit} title={t("edit_page")} active={isEditing === page.id} onClick={() => handleEdit(page)} />
                    <RowAction icon={Eye} title={t("view_page")} href={`/${locale}/pages/${page.slug}`} external />
                    <RowAction icon={Trash2} tone="destructive" title={t("delete")} disabled={isDeleting} onClick={() => handleDeleteClick(page.id)} />
                  </RowActions>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">{t("no_pages")}</div>
          )}
        </div>

        {/* Add / edit page */}
        <div ref={formBlockRef} className="lg:col-span-4 order-1 bg-card rounded-xl border border-border overflow-hidden h-fit scroll-mt-4">
          <div className="relative p-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <h3 className={BLOCK_HEADER_CLASS}>
              {isEditing ? t("edit_page") : t("add_page")}
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
          <div className="p-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FormField
                  control={form.control}
                  name={`title.${locale}` as any}
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className={BLOCK_HEADER_CLASS}>{t("title")}</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="text" placeholder={t("placeholder_page_title")} />
                      </FormControl>
                      <FormMessage className="text-xs font-medium text-destructive" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`description.${locale}` as any}
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className={BLOCK_HEADER_CLASS}>{t("description")}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          rows={12}
                          className="resize-y"
                          placeholder={t("placeholder_page_description")}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">{t("page_description_hint")}</p>
                      <FormMessage className="text-xs font-medium text-destructive" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className={BLOCK_HEADER_CLASS}>{t("page_slug")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          type="text"
                          placeholder="about"
                          onChange={(event) => {
                            // Invalidate any suggestion still in flight, and hand control back to the
                            // title when the field is emptied.
                            slugRequestId.current++;
                            setSlugTouched(event.target.value !== "");
                            field.onChange(event);
                          }}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">{t("page_slug_hint")}</p>
                      <FormMessage className="text-xs font-medium text-destructive" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="showInMenu"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-1">
                      <FormControl>
                        <Checkbox
                          id="pageShowInMenu"
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel htmlFor="pageShowInMenu" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">
                          {t("page_show_in_menu")}
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
                  {isEditing ? t("save") : t("add_page")}
                </button>
              </form>
            </Form>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("pages")}
        message={t("delete_confirm_page")}
        confirmText={t("delete") || "Delete"}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmDelete}
        onClose={handleDeleteClose}
        isLoading={isDeleting}
      />
    </div>
  );
}
