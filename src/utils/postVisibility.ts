import { isAdminRequest } from "@/utils/auth";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import type { PostStatus } from "@/types";

// Draft and Archived posts are for the admin only; anonymous readers get Published.

export async function resolveStatusFilter(requested: string | undefined): Promise<string | undefined> {
  const isAdmin = await isAdminRequest();

  // "all" is the admin dashboard's explicit signal that it wants every status. A caller without
  // a valid admin token asking for "all" almost certainly had one and lost it (token expiry), so
  // this answers 401 instead of silently narrowing to Published like every other status value does.
  if (requested === "all") {
    if (!isAdmin) throw new UnauthorizedError("Authentication required");
    return undefined;
  }

  return isAdmin ? requested : "Published";
}

export async function visibleToViewer<T extends { status: PostStatus }>(post: T | undefined): Promise<T | undefined> {
  if (!post || post.status === "Published") return post;
  return (await isAdminRequest()) ? post : undefined;
}
