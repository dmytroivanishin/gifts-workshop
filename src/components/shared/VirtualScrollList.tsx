"use client";

import { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/utils/cn";

interface VirtualScrollListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize: number;
  onEndReached?: () => void;
  className?: string;
  // How many pixels of remaining scroll trigger onEndReached — tuned once at the call site
  // rather than fired only when truly at the very last pixel.
  endReachedThreshold?: number;
}

export default function VirtualScrollList<T>({
  items,
  renderItem,
  estimateSize,
  onEndReached,
  className,
  endReachedThreshold = 200,
}: VirtualScrollListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!onEndReached || !virtualItems.length) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem.index >= items.length - 1 && virtualizer.scrollOffset !== null) {
      const totalSize = virtualizer.getTotalSize();
      const scrollOffset = virtualizer.scrollOffset ?? 0;
      const viewportSize = parentRef.current?.clientHeight ?? 0;
      if (totalSize - scrollOffset - viewportSize < endReachedThreshold) {
        onEndReached();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on every virtualizer scroll/measure tick, not just when the item list identity changes.
  }, [virtualItems, items.length, onEndReached, endReachedThreshold]);

  return (
    <div ref={parentRef} data-test-id="virtual-scroll-list" className={cn("overflow-y-auto", className)}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => (
          <div
            key={virtualRow.key}
            // Rows are absolutely positioned, so a parent's divide-y cannot draw the separators.
            className={virtualRow.index < items.length - 1 ? "border-b border-border/45" : undefined}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
