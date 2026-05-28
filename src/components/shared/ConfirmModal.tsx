"use client";

import { X, AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onClose,
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans animate-fade-in">
      <div className="bg-white rounded-3xl border border-border/45 w-full max-w-[440px] p-6 space-y-5 shadow-xl flex flex-col animate-scale-up animate-duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-full bg-[#F1E7E7] text-[#B87070] flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full border border-border hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="text-sm text-muted-foreground leading-relaxed min-h-[36px] flex items-center">
          {message}
        </div>

        {/* Footer */}
        <div className="border-t pt-4 flex gap-2.5 justify-end mt-auto">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-medium text-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B87070] hover:bg-[#8F4A4A] text-white font-medium text-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}
