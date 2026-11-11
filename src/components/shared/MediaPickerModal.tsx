"use client";

import { cn } from "@/utils/cn";
import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { SelectionMark } from "@/components/shared/SelectionMark";
import { useGetMediaQuery } from "@/store/api";
import { handleImageLoadError } from "@/utils/mediaPlaceholder";

import { useTranslation } from "@/i18n";
import { MODAL_TITLE_CLASS } from "@/utils/designTokens";
import { BUTTON_M_SIZE } from "@/utils/designTokens";

interface MediaPickerModalProps {
  onClose: () => void;
  onSelect: (mediaArray: { mediaId: string; url: string }[]) => void;
  selectedIds: string[];
}

export default function MediaPickerModal({ onClose, onSelect, selectedIds }: MediaPickerModalProps) {
  const { data: mediaResponse, isLoading } = useGetMediaQuery();
  const mediaList = mediaResponse?.data || [];
  const { t } = useTranslation();
  
  const [currentSelected, setCurrentSelected] = useState<string[]>(selectedIds);

  const toggleSelect = (id: string) => {
    // Functional update: two quick clicks in a row must both count, not overwrite each other.
    setCurrentSelected((prev) =>
      prev.includes(id) ? prev.filter((existingId) => existingId !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    const selectedData = currentSelected.map(id => {
      const media = mediaList.find(candidate => candidate.id === id);
      return {
        mediaId: id,
        url: media?.originalUrl || "",
      };
    }).filter(entry => entry.url);
    onSelect(selectedData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans animate-fade-in">
      <div className="bg-white rounded-3xl border border-border/45 w-full max-w-[440px] px-5 py-4 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b pb-2.5">
          <div className="min-w-0">
            <h3 className={MODAL_TITLE_CLASS}>{t("select_media")}</h3>
            <p className="text-xs text-muted-foreground">{t("select_media_description")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full border border-border hover:bg-muted text-subtle-foreground transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-muted-foreground" size={32} />
            </div>
          ) : mediaList.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {t("no_media_found")}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-1">
              {mediaList.map((media) => {
                const isSelected = currentSelected.includes(media.id);
                return (
                  <div
                    key={media.id}
                    data-test-id={`media-option-${media.id}`}
                    onClick={() => toggleSelect(media.id)}
                    className={`group relative aspect-square bg-muted rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    <img
                      src={media.thumbnailUrl || media.originalUrl}
                      onError={handleImageLoadError}
                      alt="Media thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <SelectionMark selected={isSelected} className="absolute top-2 left-2 z-10" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t pt-3 flex justify-between items-center gap-3 mt-auto">
          <span className="min-w-0 text-[13px] font-medium text-muted-foreground">
            {currentSelected.length} {t("items_selected")}
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={onClose}
              className={cn(BUTTON_M_SIZE, "rounded-lg border border-border text-subtle-foreground hover:text-foreground hover:bg-muted font-medium transition-colors cursor-pointer")}
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleSave}
              className={cn(BUTTON_M_SIZE, "rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity cursor-pointer")}
            >
              {t("confirm_selection")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
