"use client";

import { useState } from "react";

interface MutationTrigger {
  (id: string): { unwrap: () => Promise<unknown> };
}

interface UseDeleteConfirmOptions {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
  // The 5 admin pages using this hook genuinely differ on whether the modal closes after a failed
  // delete (leaving it open so the user sees the error toast behind it) or always closes — each
  // caller states its own existing behavior explicitly rather than the hook picking one default.
  closeOnError: boolean;
}

interface UseDeleteConfirmResult {
  isOpen: boolean;
  targetId: string;
  handleDeleteClick: (id: string) => void;
  handleConfirmDelete: () => Promise<void>;
  handleClose: () => void;
}

// Collapses the delete-confirm state/handlers duplicated identically across
// admin/{categories,collections,colors,tags,media}/page.tsx into one place.
export function useDeleteConfirm(
  deleteTrigger: MutationTrigger,
  { onSuccess, onError, closeOnError }: UseDeleteConfirmOptions
): UseDeleteConfirmResult {
  const [isOpen, setIsOpen] = useState(false);
  const [targetId, setTargetId] = useState("");

  const handleDeleteClick = (id: string) => {
    setTargetId(id);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!targetId) return;
    try {
      await deleteTrigger(targetId).unwrap();
      setIsOpen(false);
      setTargetId("");
      await onSuccess?.();
    } catch (error) {
      onError?.(error);
      if (closeOnError) {
        setIsOpen(false);
        setTargetId("");
      }
    }
  };

  return { isOpen, targetId, handleDeleteClick, handleConfirmDelete, handleClose };
}
