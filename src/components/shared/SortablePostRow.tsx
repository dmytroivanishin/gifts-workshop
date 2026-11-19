"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslation } from "@/i18n";

interface SortablePostRowProps {
  id: string;
  // Dragging is only offered for the whole, unfiltered list (see the admin posts page).
  disabled: boolean;
  as: "tr" | "div";
  className?: string;
  // The row's own cell or block receives the drag handle: it is the only element that starts a drag,
  // so clicks on the rest of the row (checkbox, links, buttons) keep working.
  children: (dragHandle: ReactNode) => ReactNode;
}

// One sortable row of the admin posts list, used for both the desktop table and the mobile cards.
// Each layout renders its own DndContext, so the same ids in both layouts never collide.
export function SortablePostRow({ id, disabled, as, className, children }: SortablePostRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  const dragHandle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label={t("drag_to_reorder")}
      title={t("drag_to_reorder")}
      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-grab active:cursor-grabbing touch-none"
    >
      <GripVertical size={14} />
    </button>
  );

  if (as === "tr") {
    return (
      <tr ref={setNodeRef} style={style} className={className}>
        {children(dragHandle)}
      </tr>
    );
  }
  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children(dragHandle)}
    </div>
  );
}
