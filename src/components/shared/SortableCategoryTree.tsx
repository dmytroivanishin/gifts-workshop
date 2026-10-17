"use client";

import React, { useMemo } from "react";
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItemWrapper({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex items-stretch bg-card ${
        isDragging ? "opacity-70 shadow-xl scale-[1.01]" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        style={{ touchAction: "none" }}
        className="flex items-center justify-center px-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors border-r border-border/40"
      >
        <GripVertical size={16} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

interface SortableCategoryItem {
  id: string;
  parentId?: string | null;
  order?: number;
}

interface SortableCategoryGroupProps<T extends SortableCategoryItem> {
  parentId: string | null;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onReorder: (newItems: T[]) => void;
}

export function SortableCategoryGroup<T extends SortableCategoryItem>({
  parentId,
  items,
  renderItem,
  onReorder,
}: SortableCategoryGroupProps<T>) {
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

  const children = useMemo(() => {
    return items
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [items, parentId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = children.findIndex((i) => i.id === active.id);
      const newIndex = children.findIndex((i) => i.id === over.id);
      onReorder(arrayMove(children, oldIndex, newIndex));
    }
  };

  if (children.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-0 divide-y divide-border/45 border-y border-border/45 first:border-t-0">
        <SortableContext
          items={children.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {children.map((item) => (
            <div key={item.id} className="flex flex-col">
              <SortableItemWrapper id={item.id}>
                {renderItem(item)}
              </SortableItemWrapper>
              
              {/* Recursive child rendering */}
              {items.some((c) => c.parentId === item.id) && (
                <div className="pl-6 border-l-2 border-primary/20 ml-6 bg-muted/5">
                  <SortableCategoryGroup
                    parentId={item.id}
                    items={items}
                    renderItem={renderItem}
                    onReorder={onReorder}
                  />
                </div>
              )}
            </div>
          ))}
        </SortableContext>
      </div>
    </DndContext>
  );
}
