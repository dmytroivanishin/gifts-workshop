"use client";

import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Move, Star } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Media, Position } from "@/types";

interface MediaItem {
  mediaId: string;
  url: string;
  position?: Position;
}

interface SortableMediaItemProps {
  item: MediaItem;
  isCover: boolean;
  mediaItemDetails: Media | undefined; // from mediaList
  onSetCover: (id: string, position?: Position) => void;
  onCrop: (id: string) => void;
  onRemove: (id: string) => void;
}

function SortableMediaItem({
  item,
  isCover,
  mediaItemDetails,
  onSetCover,
  onCrop,
  onRemove,
}: SortableMediaItemProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.mediaId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const isPortrait =
    mediaItemDetails?.orientation?.toLowerCase() === "portrait" ||
    (mediaItemDetails?.height &&
      mediaItemDetails?.width &&
      mediaItemDetails.height > mediaItemDetails.width);
  const isLandscape =
    mediaItemDetails?.orientation?.toLowerCase() === "landscape" ||
    (mediaItemDetails?.height &&
      mediaItemDetails?.width &&
      mediaItemDetails.width > mediaItemDetails.height);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative aspect-square bg-muted rounded-lg overflow-hidden border-2 transition-all ${
        isCover ? "border-primary ring-2 ring-primary/25" : "border-border"
      } ${isDragging ? "opacity-50 ring-2 ring-primary shadow-xl scale-105" : ""}`}
    >
      {/* Remove Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.mediaId);
        }}
        className="absolute top-2 right-2 z-20 p-1.5 bg-background/80 hover:bg-destructive text-muted-foreground hover:text-destructive-foreground rounded-full shadow-sm backdrop-blur-sm transition-colors cursor-pointer"
        title={t("remove")}
      >
        <X size={14} />
      </button>

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        style={{ touchAction: "none" }}
        data-test-id="media-drag-handle"
        className="absolute top-2 left-2 z-20 p-1.5 bg-background/80 text-muted-foreground hover:text-foreground rounded-md shadow-sm backdrop-blur-sm cursor-grab active:cursor-grabbing transition-colors"
        title={t("drag_to_reorder")}
      >
        <GripVertical size={14} />
      </div>

      <img
        src={item.url}
        alt=""
        className="absolute pointer-events-none"
        style={{
          left: item.position ? `calc(50% + ${item.position.x / 3}%)` : "50%",
          top: item.position ? `calc(50% + ${item.position.y / 3}%)` : "50%",
          width: isPortrait ? "100%" : isLandscape ? "auto" : "100%",
          height: isLandscape ? "100%" : isPortrait ? "auto" : "100%",
          minWidth: isPortrait ? "100%" : "auto",
          minHeight: isLandscape ? "100%" : "auto",
          maxWidth: "none",
          maxHeight: "none",
          transformOrigin: "center center",
          transform: item.position
            ? `translate(-50%, -50%) scale(${item.position.zoom})`
            : "translate(-50%, -50%) scale(1)",
        }}
      />

      {/* Set Cover Button (Bottom Left) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!isCover) {
            onSetCover(item.mediaId, item.position);
          }
        }}
        className={`absolute bottom-2 left-2 z-20 p-1.5 rounded-md shadow-sm backdrop-blur-sm transition-colors cursor-pointer ${
          isCover 
            ? "bg-primary text-primary-foreground" 
            : "bg-background/80 hover:bg-primary text-muted-foreground hover:text-primary-foreground"
        }`}
        title={isCover ? t("cover") : t("set_cover")}
      >
        <Star size={14} className={isCover ? "fill-current" : ""} />
      </button>

      {/* Position/Crop Button (Bottom Right) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCrop(item.mediaId);
        }}
        data-test-id="media-crop-button"
        className="absolute bottom-2 right-2 z-20 p-1.5 bg-background/80 hover:bg-secondary text-foreground rounded-md shadow-sm backdrop-blur-sm transition-colors cursor-pointer"
        title={t("position")}
      >
        <Move size={14} />
      </button>
    </div>
  );
}

export function SortableMediaGrid({
  items,
  mediaList,
  coverImage,
  onReorder,
  onSetCover,
  onCrop,
  onRemove,
}: {
  items: MediaItem[];
  mediaList: Media[];
  coverImage: string;
  onReorder: (newItems: MediaItem[]) => void;
  onSetCover: (id: string, position?: Position) => void;
  onCrop: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.mediaId === active.id);
      const newIndex = items.findIndex((i) => i.mediaId === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SortableContext
          items={items.map((i) => i.mediaId)}
          strategy={rectSortingStrategy}
        >
          {items.map((img) => (
            <SortableMediaItem
              key={img.mediaId}
              item={img}
              isCover={coverImage === img.mediaId}
              mediaItemDetails={mediaList.find((m) => m.id === img.mediaId)}
              onSetCover={onSetCover}
              onCrop={onCrop}
              onRemove={onRemove}
            />
          ))}
        </SortableContext>
      </div>
    </DndContext>
  );
}
