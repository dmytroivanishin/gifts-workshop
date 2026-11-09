"use client";

import { useState, useEffect, useRef } from "react";
import { useGetTagsQuery } from "@/store/api";
import { Tag } from "@/types";

const PAGE_SIZE = 20;

interface UseTagsListResult {
  tags: Tag[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

// Reuses the same local-accumulation pattern already proven in admin/tags/page.tsx (local page
// state + dedupe-and-append on page>1) instead of an RTK-cache-level merge — lower risk, and the
// one pattern in this codebase already confirmed to handle reconciliation correctly.
export function useTagsList(search: string): UseTagsListResult {
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<Tag[]>([]);
  const prevSearchRef = useRef(search);

  // A new search term invalidates any accumulated pages — start over from page 1.
  useEffect(() => {
    if (prevSearchRef.current !== search) {
      prevSearchRef.current = search;
      setPage(1);
    }
  }, [search]);

  const { data, isLoading, isFetching } = useGetTagsQuery({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
  });

  const hasMore = data?.meta?.nextPage != null;

  useEffect(() => {
    if (!data?.data) return;
    if (page === 1) {
      setTags(data.data);
    } else {
      setTags((prev) => {
        const existingIds = new Set(prev.map((tag) => tag.id));
        const newTags = data.data.filter((tag) => !existingIds.has(tag.id));
        return [...prev, ...newTags];
      });
    }
  }, [data, page]);

  const loadMore = () => {
    if (hasMore && !isFetching) {
      setPage((previousPage) => previousPage + 1);
    }
  };

  const reload = () => {
    setPage(1);
  };

  return {
    tags,
    isLoading: isLoading && page === 1,
    isLoadingMore: isFetching && page > 1,
    hasMore,
    loadMore,
    reload,
  };
}
