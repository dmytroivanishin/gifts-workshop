"use client";

import { useState, useEffect } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import ConfirmModal from "@/components/shared/ConfirmModal";

interface MediaItem {
  id: string;
  url: string;
  name: string;
  size: string;
}

export default function AdminMedia() {
  const { t } = useTranslation();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState({ total: 0, current: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial media
  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const res = await fetch('/api/v1/media');
        if (res.ok) {
          const data = await res.json();
          if (data.data) {
            setMedia(data.data.map((m: any) => ({
              id: m.id,
              url: m.thumbnailUrl || m.originalUrl,
              name: m.originalUrl.split('/').pop() || 'image',
              size: `${m.width}x${m.height}`
            })));
          }
        }
      } catch (error) {
        console.error("Failed to fetch media", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMedia();
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    setUploadStats({ total: files.length, current: 0 });

    try {
      const newMediaItems: any[] = [];
      
      // Upload sequentially to show accurate progress bar
      for (let i = 0; i < files.length; i++) {
        setUploadStats({ total: files.length, current: i + 1 });
        const formData = new FormData();
        formData.append("files", files[i]);
        
        const response = await fetch("/api/v1/media", {
          method: "POST",
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.data && result.data.length > 0) {
            newMediaItems.push(...result.data);
          }
        }
      }
      
      if (newMediaItems.length > 0) {
        const mappedItems = newMediaItems.map((m: any) => ({
          id: m.id,
          url: m.thumbnailUrl || m.originalUrl,
          name: m.originalUrl.split('/').pop() || 'image',
          size: `${m.width}x${m.height}`
        }));
        setMedia(prev => [...mappedItems, ...prev]);
      }
    } catch (error) {
      console.error("Upload error", error);
    } finally {
      setIsUploading(false);
      setUploadStats({ total: 0, current: 0 });
    }
  };

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
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await fetch(`/api/v1/media/${deleteTargetId}`, { method: 'DELETE' });
      setMedia(media.filter((item) => item.id !== deleteTargetId));
    } catch (error) {
      console.error("Failed to delete", error);
    } finally {
      setIsDeleteOpen(false);
      setDeleteTargetId("");
    }
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
        
        {isUploading ? (
          <div className="w-full max-w-md space-y-2 mt-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t("uploading")}...</span>
              <span>{uploadStats.current} / {uploadStats.total}</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(uploadStats.current / uploadStats.total) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <label className="px-4 py-2 bg-secondary border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors cursor-pointer mt-2">
            {t("select_files")}
            <input type="file" multiple className="hidden" accept="image/jpeg,image/png,image/jpg" onChange={(e) => {
              if (e.target.files) {
                handleFiles(e.target.files);
              }
            }} />
          </label>
        )}
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={24} /> {t("loading_media")}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {media.map((item) => (
            <div key={item.id} className="group relative bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm flex flex-col justify-between">
              <div className="aspect-square relative w-full bg-muted overflow-hidden flex items-center justify-center">
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                />
                
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleDeleteClick(item.id)}
                    className="p-1.5 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
                    title={t("delete")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="p-3 border-t bg-muted/20">
                <div className="font-semibold text-xs text-foreground truncate">{item.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{item.size}</div>
              </div>
            </div>
          ))}
          {media.length === 0 && !isUploading && (
            <div className="col-span-full text-center py-10 text-muted-foreground text-sm">
              {t("no_media") || "No media found. Upload some images!"}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteOpen}
        title={t("media_library")}
        message={t("delete_confirm_media")}
        confirmText={t("delete") || "Delete"}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmDelete}
        onClose={() => setIsDeleteOpen(false)}
      />
    </div>
  );
}
