"use client";

import { FormPanelHeader } from "@/components/shared/FormPanelHeader";
import { cn } from "@/utils/cn";
import { useRef, useState } from "react";
import { Plus, Edit, Save, X, Trash2, Loader2 } from "lucide-react";
import {
  useGetColorsQuery,
  useCreateColorMutation,
  useUpdateColorMutation,
  useDeleteColorMutation,
} from "@/store/api";
import { useTranslation } from "@/i18n";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { RowAction, RowActions } from "@/components/shared/RowAction";
import PageVirtualList from "@/components/shared/PageVirtualList";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { colorSchema } from "@/common/validation/schemas";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { ApiMutationError } from "@/types";
import { BLOCK_HEADER_CLASS } from "@/utils/designTokens";
import { scrollToEditForm } from "@/utils/scrollToEditForm";

export default function AdminColors() {
  const { t } = useTranslation();

  const { data: colorsResponse, isLoading } = useGetColorsQuery();
  const [createColor, { isLoading: isCreating }] = useCreateColorMutation();
  const [updateColor, { isLoading: isUpdating }] = useUpdateColorMutation();
  const [deleteColor, { isLoading: isDeleting }] = useDeleteColorMutation();

  const colors = colorsResponse?.data || [];

  const defaultValues = { color: "#FFD2D2" };

  const form = useForm<z.infer<typeof colorSchema>>({
    resolver: zodResolver(colorSchema) as any,
    defaultValues,
    mode: "onChange"
  });

  // Edit State
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const resetForm = () => {
    setIsEditing(null);
    setIsFormOpen(false);
    form.reset(defaultValues);
  };

  // Delete Confirm State
  const {
    isOpen: isDeleteOpen,
    targetId: deleteTargetId,
    handleDeleteClick,
    handleConfirmDelete,
    handleClose: handleDeleteClose,
  } = useDeleteConfirm(deleteColor, {
    onSuccess: () => {
      if (isEditing === deleteTargetId) {
        resetForm();
      }
    },
    onError: (error) => console.error("Failed to delete color", error),
    closeOnError: false,
  });

  const formBlockRef = useRef<HTMLDivElement>(null);

  const handleEdit = (color: { id: string; color: string }) => {
    setIsEditing(color.id);
    setIsFormOpen(true);
    form.reset({ color: color.color });
    scrollToEditForm(formBlockRef.current);
  };

  const onSubmit = async (values: z.infer<typeof colorSchema>) => {
    try {
      if (isEditing) {
        await updateColor({ id: isEditing, color: values.color }).unwrap();
      } else {
        await createColor(values).unwrap();
      }
      resetForm();
    } catch (error: unknown) {
      const apiError = error as ApiMutationError;
      if (apiError?.data?.error?.details) {
        apiError.data.error.details.forEach((detail) => {
          form.setError(detail.field as any, { type: "server", message: detail.message });
        });
      }
      console.error("Failed to add color", error);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-xl sm:text-[22px] lg:text-2xl font-bold tracking-tight text-foreground">{t("colors")}</h1>
        <p className="text-xs text-muted-foreground">{t("colors_subtitle")}</p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left column: Add / Edit color form */}
        <div ref={formBlockRef} className="lg:col-span-4 order-1 bg-card rounded-xl border border-border overflow-hidden h-fit scroll-mt-4">
          <FormPanelHeader
            title={isEditing ? t("edit_color") : t("add_color")}
            isOpen={isFormOpen}
            onToggle={() => setIsFormOpen((open) => !open)}
            headingLevel="h2"
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
                name="color"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className={BLOCK_HEADER_CLASS}>HEX</FormLabel>
                    <div className="flex items-center gap-3">
                      <ColorPicker
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder="#HEX"
                          className="flex-1 uppercase"
                          maxLength={7}
                        />
                      </FormControl>
                    </div>
                    <FormMessage className="text-xs font-medium text-destructive" />
                  </FormItem>
                )}
              />

              <button
                type="submit"
                disabled={!form.formState.isValid || isCreating || isUpdating}
                className="w-full flex items-center justify-center gap-1.5 h-9 sm:h-10 px-4 bg-primary text-primary-foreground text-[13px] sm:text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {isCreating || isUpdating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isEditing ? (
                  <Save size={16} />
                ) : (
                  <Plus size={16} />
                )}
                {isEditing ? t("save") : t("add_color")}
              </button>
            </form>
          </Form>
          </div>
        </div>

        {/* Right column: Color list */}
        <div className="lg:col-span-8 order-2 bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <h2 className={BLOCK_HEADER_CLASS}>{t("colors_manager")}</h2>
          </div>

          <div>
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Loader2 className="animate-spin inline mr-2" size={16} />
                {t("loading_colors")}
              </div>
            ) : colors.length > 0 ? (
              <PageVirtualList
                items={colors}
                estimateSize={88}
                className="divide-y divide-border/45"
                renderItem={(color) => (
                  <div className="p-4 h-full flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className="size-10 rounded-[9px] border border-border flex-shrink-0"
                        style={{ backgroundColor: color.color }}
                      />
                      <span className="font-semibold text-[13px] sm:text-sm uppercase text-foreground tracking-wider truncate">{color.color}</span>
                    </div>

                    <RowActions>
                      <RowAction icon={Edit} title={t("edit_color")} active={isEditing === color.id} onClick={() => handleEdit(color)} />
                      <RowAction icon={Trash2} tone="destructive" title={t("delete")} disabled={isDeleting} onClick={() => handleDeleteClick(color.id)} />
                    </RowActions>
                  </div>
                )}
              />
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {t("colors_not_found")}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("colors")}
        message={t("delete_confirm_color")}
        confirmText={t("delete") || "Delete"}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmDelete}
        onClose={handleDeleteClose}
        isLoading={isDeleting}
      />
    </div>
  );
}
