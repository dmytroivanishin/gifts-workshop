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

export default function AdminColors() {
  const { t } = useTranslation();

  const { data: colorsResponse, isLoading } = useGetColorsQuery();
  const [createColor, { isLoading: isCreating }] = useCreateColorMutation();
  const [updateColor, { isLoading: isUpdating }] = useUpdateColorMutation();
  const [deleteColor, { isLoading: isDeleting }] = useDeleteColorMutation();

  const colors = colorsResponse?.data || [];

  // Form State
  const [newColorHex, setNewColorHex] = useState("#FFD2D2");

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColorHex, setEditColorHex] = useState("");

  // Delete Confirm State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColorHex.trim()) return;

    try {
      await createColor({ color: newColorHex }).unwrap();
      setNewColorHex("#FFD2D2");
    } catch (err) {
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left column: Add color form */}
        <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{t("add_color")}</h2>
          
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HEX</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  className="w-12 h-12 rounded-lg border border-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={newColorHex}
                  onChange={(e) => setNewColorHex(e.target.value)}
                  placeholder="#HEX"
                  className="flex-1 px-3.5 py-2.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary uppercase transition-colors"
                  maxLength={7}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {t("add_color")}
            </button>
          </form>
        </div>

        {/* Right column: Color list */}
        <div className="md:col-span-2 p-6 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">{t("colors_manager")}</h2>
            {isLoading && <Loader2 size={20} className="animate-spin text-muted-foreground" />}
          </div>

          <div className="divide-y divide-border/60">
            {colors.length > 0 ? (
              colors.map((c: any) => {
                const isEditingThis = editingId === c.id;
                return (
                  <div key={c.id} className="py-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    {isEditingThis ? (
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="color"
                          value={editColorHex}
                          onChange={(e) => setEditColorHex(e.target.value)}
                          className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={editColorHex}
                          onChange={(e) => setEditColorHex(e.target.value)}
                          className="w-40 px-3 py-1.5 rounded-lg border border-border bg-transparent text-sm outline-none focus:border-primary uppercase"
                          maxLength={7}
                          required
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full border border-border/40 shadow-inner flex items-center justify-center"
                          style={{ backgroundColor: c.color }}
                        />
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm uppercase text-foreground tracking-wider">{c.color}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">ID: {c.id.substring(0, 8)}...</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 ml-4">
                      {isEditingThis ? (
                        <>
                          <button
                            onClick={() => handleSave(c.id)}
                            disabled={isUpdating}
                            className="p-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center justify-center"
                          >
                            {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                            }}
                            className="p-1.5 rounded-md border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(c.id);
                              setEditColorHex(c.color);
                            }}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(c.id)}
                            disabled={isDeleting}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-destructive disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 size={16} />
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
