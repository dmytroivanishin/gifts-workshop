"use client";

import { useRef, useEffect } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/utils/cn";

interface PageVirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize: number;
  onEndReached?: () => void;
  className?: string;
  endReachedThreshold?: number;
}

// Virtual list that scrolls with the page, not inside its own box, so a phone user gets one
// scroll instead of a scroll inside a scroll. Used by admin lists; Combobox keeps its own list.
export default function PageVirtualList<T>({
  items,
  renderItem,
  estimateSize,
  onEndReached,
  className,
  endReachedThreshold = 200,
}: PageVirtualListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!onEndReached || !virtualItems.length) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem.index >= items.length - 1) {
      const distanceToBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      if (distanceToBottom < endReachedThreshold) {
        onEndReached();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on every scroll tick of the window virtualizer, not only when the item list identity changes.
  }, [virtualItems, items.length, onEndReached, endReachedThreshold]);

  return (
    <div ref={listRef} data-test-id="page-virtual-list" className={cn("relative", className)}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        {virtualItems.map((virtualRow) => (
          <div
            key={virtualRow.key}
            className={virtualRow.index < items.length - 1 ? "border-b border-border/45" : undefined}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
