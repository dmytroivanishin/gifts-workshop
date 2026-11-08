"use client";

import { useState } from "react";
import { Plus, Edit, Save, X, Trash2, Loader2 } from "lucide-react";
import {
  useGetColorsQuery,
  useCreateColorMutation,
  useUpdateColorMutation,
  useDeleteColorMutation,
} from "@/store/api";
import { useTranslation } from "@/i18n";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import VirtualScrollList from "@/components/shared/VirtualScrollList";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { colorSchema } from "@/common/validation/schemas";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { ApiMutationError } from "@/types";

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

  const resetForm = () => {
    setIsEditing(null);
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
    onError: (err) => console.error("Failed to delete color", err),
    closeOnError: false,
  });

  const handleEdit = (c: { id: string; color: string }) => {
    setIsEditing(c.id);
    form.reset({ color: c.color });
  };

  const onSubmit = async (values: z.infer<typeof colorSchema>) => {
    try {
      if (isEditing) {
        await updateColor({ id: isEditing, color: values.color }).unwrap();
      } else {
        await createColor(values).unwrap();
      }
      resetForm();
    } catch (err: unknown) {
      const apiError = err as ApiMutationError;
      if (apiError?.data?.error?.details) {
        apiError.data.error.details.forEach((detail) => {
          form.setError(detail.field as any, { type: "server", message: detail.message });
        });
      }
      console.error("Failed to add color", err);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("colors")}</h1>
        <p className="text-sm text-muted-foreground">{t("colors_subtitle")}</p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left column: Add / Edit color form */}
        <div className="lg:col-span-4 order-1 bg-card rounded-xl border border-border overflow-hidden h-fit">
          <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isEditing ? t("edit_color") : t("add_color")}
            </h2>
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
          <div className="p-5 space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HEX</FormLabel>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="w-12 h-12 rounded-lg border border-border cursor-pointer bg-transparent shrink-0"
                      />
                      <FormControl>
                        <input
                          {...field}
                          type="text"
                          placeholder="#HEX"
                          className={`flex-1 w-full px-3.5 py-2.5 rounded-lg border bg-transparent text-sm outline-none focus:border-primary uppercase transition-colors ${form.formState.errors.color ? "border-destructive text-destructive focus:border-destructive" : "border-border"}`}
                          maxLength={7}
                        />
                      </FormControl>
                    </div>
                    <FormMessage className="text-[0.8rem] font-medium text-destructive" />
                  </FormItem>
                )}
              />

              <button
                type="submit"
                disabled={!form.formState.isValid || isCreating || isUpdating}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
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
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("colors_manager")}</h2>
            {isLoading && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          </div>

          <div>
            {colors.length > 0 ? (
              <VirtualScrollList
                items={colors}
                estimateSize={88}
                className="max-h-[70vh] divide-y divide-border/60"
                renderItem={(c) => (
                  <div className="p-4 h-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full border border-border/40 shadow-inner flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm uppercase text-foreground tracking-wider">{c.color}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">ID: {c.id.substring(0, 8)}...</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleEdit(c)}
                        className={`p-2 sm:p-1.5 rounded-md hover:bg-muted transition-colors text-subtle-foreground hover:text-foreground cursor-pointer ${
                          isEditing === c.id ? "bg-muted text-foreground" : ""
                        }`}
                        title={t("edit_color")}
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(c.id)}
                        disabled={isDeleting}
                        className="p-2 sm:p-1.5 rounded-md hover:bg-muted transition-colors text-subtle-foreground hover:text-destructive disabled:opacity-50 cursor-pointer"
                        title={t("delete")}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              />
            ) : (
              !isLoading && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {t("colors_not_found")}
                </div>
              )
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
