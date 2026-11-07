"use client";

import { useState } from "react";
import { Upload, Trash2, Loader2, Search, Check, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/i18n";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { useDispatch } from "react-redux";
import { addNotification } from "@/store/slices/notificationSlice";
import {
  useGetMediaQuery,
  useUploadMediaMutation,
  useDeleteMediaMutation,
  useBulkDeleteMediaMutation,
} from "@/store/api";
import { ApiMutationError } from "@/types";
import { handleImageLoadError } from "@/utils/mediaPlaceholder";

// A single upload's outcome once it didn't simply succeed: either the server found this file's
// content already stored under a different name (CP-50 point 4 — a hard 409 block, not just a
// warning) or the upload genuinely failed for some other reason (bad type, too large, network).
// Rendered as one unified list so clicking a duplicate's name can jump straight to it via search.
interface UploadIssue {
  fileName: string;
  kind: "duplicate" | "failed";
  existingMediaName?: string;
}

interface MediaItem {
  id: string;
  url: string;
  name: string;
  size: string;
}

// POST /media takes one file per request now, so there's nothing left for the server to cap —
// this guards the UI's own sequential batch instead: RATE_LIMITS.upload (src/utils/rateLimit.ts)
// allows 30 requests/minute, so a larger selection would just start failing with 429s partway
// through the loop.
const MAX_FILES_PER_UPLOAD = Number(process.env.NEXT_PUBLIC_MAX_FILES_PER_UPLOAD) || 30;

export default function AdminMedia() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState({ total: 0, current: 0 });
  const [uploadIssues, setUploadIssues] = useState<UploadIssue[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  const { data: mediaData, isLoading } = useGetMediaQuery(search ? { search } : undefined);
  const [uploadMedia] = useUploadMediaMutation();
  const [deleteMedia] = useDeleteMediaMutation();
  const [bulkDeleteMedia, { isLoading: isBulkDeleting }] = useBulkDeleteMediaMutation();
  const {
    isOpen: isDeleteOpen,
    handleDeleteClick,
    handleConfirmDelete,
    handleClose: handleDeleteClose,
  } = useDeleteConfirm(deleteMedia, {
    onSuccess: () => {
      dispatch(addNotification({ type: 'success', messageKey: 'media_deleted' }));
    },
    onError: (err: unknown) => {
      const errorData = (err as ApiMutationError)?.data;
      const errorCode = errorData?.error?.code || 'DELETE_FAILED';
      dispatch(addNotification({
        type: 'error',
        messageKey: errorCode,
        details: errorData?.error?.message || 'Failed to delete media'
      }));
    },
    closeOnError: true,
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    try {
      const result = await bulkDeleteMedia(ids).unwrap();
      const { deleted, blocked } = result.data;
      setIsBulkDeleteOpen(false);
      setSelectedIds(new Set());

      if (blocked.length > 0) {
        dispatch(addNotification({
          type: deleted.length > 0 ? 'warning' : 'error',
          messageKey: 'media_bulk_partial',
          details: `Deleted ${deleted.length} of ${ids.length}; ${blocked.length} skipped because they're used in a post.`,
        }));
      } else {
        dispatch(addNotification({ type: 'success', messageKey: 'media_bulk_deleted' }));
      }
    } catch (err: unknown) {
      setIsBulkDeleteOpen(false);
      const errorData = (err as ApiMutationError)?.data;
      const errorCode = errorData?.error?.code || 'DELETE_FAILED';
      dispatch(addNotification({
        type: 'error',
        messageKey: errorCode,
        details: errorData?.error?.message || 'Failed to delete selected media'
      }));
    }
  };

  const media: MediaItem[] = (mediaData?.data || []).map((m) => ({
    id: m.id,
    url: m.thumbnailUrl || m.originalUrl,
    name: m.displayName,
    size: `${m.width}x${m.height}`
  }));

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    if (files.length > MAX_FILES_PER_UPLOAD) {
      dispatch(addNotification({
        type: 'error',
        messageKey: 'TOO_MANY_FILES',
        details: `You can upload at most ${MAX_FILES_PER_UPLOAD} files at once. Please select fewer files.`
      }));
      return;
    }

    setIsUploading(true);
    setUploadStats({ total: files.length, current: 0 });
    setUploadIssues([]);

    try {
      let anySucceeded = false;

      // Upload sequentially to show accurate progress bar
      for (let i = 0; i < files.length; i++) {
        setUploadStats({ total: files.length, current: i + 1 });
        const formData = new FormData();
        formData.append("file", files[i]);

        try {
          await uploadMedia(formData).unwrap();
          anySucceeded = true;
        } catch (err: unknown) {
          const errorData = (err as ApiMutationError)?.data;
          const errorCode = errorData?.error?.code || 'UPLOAD_FAILED';

          if (errorCode === 'DUPLICATE_MEDIA') {
            const existingMediaName = errorData?.error?.details?.find(
              (d) => d.field === 'existingMediaName'
            )?.message;
            setUploadIssues(prev => [...prev, { fileName: files[i].name, kind: 'duplicate', existingMediaName }]);
          } else {
            setUploadIssues(prev => [...prev, { fileName: files[i].name, kind: 'failed' }]);
          }

          dispatch(addNotification({
            type: 'error',
            messageKey: errorCode,
            details: errorData?.error?.message || 'Upload failed'
          }));
        }
      }

      if (anySucceeded) {
        dispatch(addNotification({ type: 'success', messageKey: 'media_uploaded' }));
      }
    } catch (error) {
      console.error("Upload error", error);
      dispatch(addNotification({ type: 'error', messageKey: 'UNKNOWN_ERROR', details: 'Network error' }));
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
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 transition-colors ${dragActive
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/60 bg-card"
          }`}
      >
        <div className="p-3 rounded-full bg-secondary text-muted-foreground">
          <Upload size={24} />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">{t("drag_drop_files")}</p>
          <p className="text-xs text-muted-foreground">{t("media_limits")} {process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || "10"}MB</p>
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

      {/* Upload issues: a unified popup-style panel for this batch's problems — a duplicate
          (CP-50 point 4) is a normal-colored, clickable label naming the existing match (click
          jumps the search box to it); a genuine failure stays red and non-clickable, as before.
          Rendered outside the dropzone's dashed border (not nested inside it) so it reads as its
          own transient notice rather than part of the drop target, and animates in/out instead of
          abruptly appearing. */}
      <AnimatePresence>
        {uploadIssues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <AlertTriangle size={14} className="text-muted-foreground" />
                {t("upload_issues")}
              </p>
              <ul className="space-y-1 text-xs">
                {uploadIssues.map((issue, i) => (
                  <li key={i}>
                    {issue.kind === "duplicate" ? (
                      <button
                        type="button"
                        onClick={() => setSearch(issue.existingMediaName || issue.fileName)}
                        className="text-left truncate text-foreground hover:text-primary underline decoration-dotted cursor-pointer"
                      >
                        <span className="truncate">{issue.fileName}</span>
                        {issue.existingMediaName && (
                          <span className="text-muted-foreground"> — {t("duplicate_of")} &ldquo;{issue.existingMediaName}&rdquo;</span>
                        )}
                      </button>
                    ) : (
                      <span className="truncate text-destructive block">{issue.fileName}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar: search on the left, bulk-selection controls on the right — one persistent
          panel (not a separate block that mounts/unmounts) so selecting or clearing cards never
          shifts the grid below. */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-secondary p-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("placeholder_search_media")}
            className="w-full pl-9 pr-4 py-2.5 sm:py-2 rounded-lg border border-border bg-card font-sans text-sm outline-none focus:border-primary"
          />
        </div>

        {selectedIds.size > 0 && (
          <div data-test-id="bulk-action-bar" className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-medium text-foreground whitespace-nowrap">
              {selectedIds.size} {t("items_selected")}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted font-medium text-xs transition-colors cursor-pointer"
              >
                {t("cancel") || "Cancel"}
              </button>
              <button
                type="button"
                data-test-id="bulk-delete-button"
                title={t("delete_selected")}
                onClick={() => setIsBulkDeleteOpen(true)}
                className="p-2 rounded-lg border border-destructive/20 hover:border-destructive bg-destructive/5 hover:bg-destructive text-destructive hover:text-white transition-all cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={24} /> {t("loading_media")}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {media.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
            <div
              key={item.id}
              data-test-id={`media-card-${item.id}`}
              className={`group relative bg-card rounded-xl border overflow-hidden shadow-sm flex flex-col justify-between transition-all ${
                isSelected ? "border-primary ring-2 ring-primary/20" : "border-border/40"
              }`}
            >
              <div className="aspect-square relative w-full bg-muted overflow-hidden flex items-center justify-center">
                {/* A <label>+checkbox, not a <button> — every existing media test locates the
                    card's delete action via card.locator("button"), expecting exactly one; a
                    second <button> here would make that ambiguous across every test file that
                    already relies on it. */}
                <label
                  data-test-id={`media-select-${item.id}`}
                  title={t("select")}
                  className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center shadow-sm transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-white/80 border-border text-transparent hover:border-primary"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(item.id)}
                    className="sr-only"
                  />
                  <Check size={14} strokeWidth={3} />
                </label>
                <img
                  src={item.url}
                  onError={handleImageLoadError}
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                />
              </div>

              <div className="p-3 border-t bg-muted/20 space-y-2.5">
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-foreground truncate">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.size}</div>
                </div>

                <button
                  onClick={() => handleDeleteClick(item.id)}
                  className="w-full py-2 sm:py-1.5 rounded-lg border border-destructive/20 hover:border-destructive bg-destructive/5 hover:bg-destructive text-destructive hover:text-white transition-all text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  title={t("delete")}
                >
                  <Trash2 size={14} />
                  {t("delete") || "Delete"}
                </button>
              </div>
            </div>
            );
          })}
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
        onClose={handleDeleteClose}
      />

      <ConfirmModal
        isOpen={isBulkDeleteOpen}
        title={t("media_library")}
        message={`${selectedIds.size} ${t("items_selected")}. ${t("confirm_bulk_delete_media")}`}
        confirmText={t("delete_selected")}
        cancelText={t("cancel") || "Cancel"}
        onConfirm={handleConfirmBulkDelete}
        onClose={() => setIsBulkDeleteOpen(false)}
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
