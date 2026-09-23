import { isAdminRequest } from "@/utils/auth";
import type { PostStatus } from "@/types";

// Draft and Archived posts are for the admin only; anonymous readers get Published.

export async function resolveStatusFilter(requested: string | undefined): Promise<string | undefined> {
  return (await isAdminRequest()) ? requested : "Published";
}

export async function visibleToViewer<T extends { status: PostStatus }>(post: T | undefined): Promise<T | undefined> {
  if (!post || post.status === "Published") return post;
  return (await isAdminRequest()) ? post : undefined;
}
