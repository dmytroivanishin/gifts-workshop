"use client";

import { useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { useTranslation } from "@/i18n";

interface MediaItem {
  id: string;
  url: string;
  name: string;
  size: string;
}

const INITIAL_MEDIA: MediaItem[] = [
  { id: "m1", url: "/images/image-1.png", name: "bunny-window.png", size: "1.9 MB" },
  { id: "m2", url: "/images/image-2.png", name: "bunny-chair.png", size: "1.8 MB" },
  { id: "m3", url: "/images/image-3.png", name: "bunny-cozy.png", size: "1.8 MB" },
  { id: "m4", url: "/images/image-4.png", name: "giraffe-scarf.png", size: "2.0 MB" },
  { id: "m5", url: "/images/image-5.png", name: "bunny-cottage.png", size: "2.3 MB" },
];

export default function AdminMedia() {
  const { t } = useTranslation();
  const [media, setMedia] = useState<MediaItem[]>(INITIAL_MEDIA);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const newItem: MediaItem = {
        id: `m-${Date.now()}`,
        url: URL.createObjectURL(file),
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      };
      setMedia([newItem, ...media]);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("delete_confirm_media"))) return;
    setMedia(media.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("media_library")}</h1>
        <p className="text-sm text-muted-foreground">{t("media_subtitle")}</p>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/60 bg-card"
        }`}
      >
        <div className="p-3 rounded-full bg-secondary text-muted-foreground">
          <Upload size={24} />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">{t("drag_drop_files")}</p>
          <p className="text-xs text-muted-foreground">{t("media_limits")}</p>
        </div>
        <label className="px-4 py-2 bg-secondary border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors cursor-pointer">
          {t("select_files")}
          <input type="file" className="hidden" onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              const file = e.target.files[0];
              const newItem: MediaItem = {
                id: `m-${Date.now()}`,
                url: URL.createObjectURL(file),
                name: file.name,
                size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
              };
              setMedia([newItem, ...media]);
            }
          }} />
        </label>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {media.map((item) => (
          <div key={item.id} className="group relative bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm flex flex-col justify-between">
            {/* Image Thumbnail */}
            <div className="aspect-square relative w-full bg-muted overflow-hidden">
              <img
                src={item.url}
                alt={item.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
              />
              
              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                  title={t("delete")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Meta */}
            <div className="p-3 border-t bg-muted/20">
              <div className="font-semibold text-xs text-foreground truncate">{item.name}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{item.size}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
