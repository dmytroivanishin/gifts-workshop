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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColorHex, setEditColorHex] = useState("");

  // Delete Confirm State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState("");

  const onSubmit = async (values: z.infer<typeof colorSchema>) => {
    try {
      await createColor(values).unwrap();
      form.reset(defaultValues);
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

  const handleSave = async (id: string) => {
    if (!editColorHex.trim()) return;
    try {
      await updateColor({
        id,
        color: editColorHex,
      }).unwrap();
      setEditingId(null);
    } catch (err) {
      console.error("Failed to save color", err);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteColor(deleteTargetId).unwrap();
      setIsDeleteOpen(false);
      setDeleteTargetId("");
    } catch (err) {
      console.error("Failed to delete color", err);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("colors")}</h1>
        <p className="text-sm text-muted-foreground">{t("colors_subtitle")}</p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left column: Add color form */}
        <div className="lg:col-span-4 order-1 p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{t("add_color")}</h2>
          
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
                disabled={!form.formState.isValid || isCreating}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {t("add_color")}
              </button>
            </form>
          </Form>
        </div>

        {/* Right column: Color list */}
        <div className="lg:col-span-8 order-2 p-6 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">{t("colors_manager")}</h2>
            {isLoading && <Loader2 size={20} className="animate-spin text-muted-foreground" />}
          </div>

          <div className="divide-y divide-border/60">
            {colors.length > 0 ? (
              colors.map((c) => {
                const isEditingThis = editingId === c.id;
                return (
                  <div key={c.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0 hover:bg-muted/10 transition-colors">
                    {isEditingThis ? (
                      <div className="flex items-center gap-3 flex-1 w-full">
                        <input
                          type="color"
                          value={editColorHex}
                          onChange={(e) => setEditColorHex(e.target.value)}
                          className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={editColorHex}
                          onChange={(e) => setEditColorHex(e.target.value)}
                          className="w-full sm:w-40 px-3 py-2 sm:py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary uppercase"
                          maxLength={7}
                          required
                        />
                      </div>
                    ) : (
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
                    )}

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {isEditingThis ? (
                        <>
                          <button
                            onClick={() => handleSave(c.id)}
                            disabled={isUpdating}
                            className="p-2 sm:p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center justify-center"
                          >
                            {isUpdating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                            }}
                            className="p-2 sm:p-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(c.id);
                              setEditColorHex(c.color);
                            }}
                            className="p-2 sm:p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(c.id)}
                            disabled={isDeleting}
                            className="p-2 sm:p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-destructive disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              !isLoading && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Цвета не найдены.
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
        onClose={() => setIsDeleteOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
}
