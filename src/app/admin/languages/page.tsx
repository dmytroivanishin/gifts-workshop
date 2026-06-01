"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, CheckCircle2, XCircle, Trash2, Edit } from "lucide-react";
import { useGetLanguagesQuery, useCreateLanguageMutation, useUpdateLanguageMutation, useDeleteLanguageMutation } from "@/store/api";

export default function ManageLanguagesPage() {
  const router = useRouter();
  const { data, isLoading } = useGetLanguagesQuery();
  const [createLanguage] = useCreateLanguageMutation();
  const [updateLanguage] = useUpdateLanguageMutation();
  const [deleteLanguage] = useDeleteLanguageMutation();

  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    if (!newCode || !newName) return;
    await createLanguage({ code: newCode, name: newName, isActive: true });
    setNewCode("");
    setNewName("");
    setIsAdding(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await updateLanguage({ id, isActive: !currentStatus });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this language? This might break existing translations.")) {
      await deleteLanguage(id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Manage Languages
          </h1>
          <p className="text-sm text-muted-foreground">
            Add or remove languages for the application
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/40 p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Active Languages</h2>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Add Language
          </button>
        </div>

        {isAdding && (
          <div className="flex gap-4 items-end bg-secondary/50 p-4 rounded-lg mb-4 border border-border/40">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Language Code (e.g., 'es', 'fr')</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="es"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Display Name (e.g., 'Español')</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-background border border-border/40 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Español"
              />
            </div>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-md hover:bg-emerald-700 transition-colors h-[38px]"
            >
              Save
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4">Loading languages...</div>
        ) : (
          <div className="divide-y divide-border/40 border border-border/40 rounded-lg overflow-hidden">
            {data?.data.map((lang) => (
              <div key={lang.id} className="flex items-center justify-between p-4 bg-background">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${lang.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {lang.code.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{lang.name}</h3>
                    <p className="text-xs text-muted-foreground">Code: {lang.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(lang.id, lang.isActive)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      lang.isActive 
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20' 
                        : 'bg-secondary text-muted-foreground border-border/40 hover:bg-secondary/80'
                    }`}
                  >
                    {lang.isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {lang.isActive ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => handleDelete(lang.id)}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {data?.data.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No languages configured.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
