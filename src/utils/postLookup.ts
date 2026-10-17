import { cache } from "react";
import { postService } from "@/modules/core/container";
import { isUUID } from "@/utils/uuid";
import { visibleToViewer } from "@/utils/postVisibility";
import { PopulatedPost } from "@/types";

// Shared by the project page's layout (generateMetadata + the UUID->slug redirect check) and the
// page itself, all of which need the exact same post. React.cache() scopes the memoization to a
// single request only (never shared between different visitors/requests), so this collapses what
// would otherwise be up to 3 identical DB round trips per request into 1, with no behavior change.
export const getVisiblePostBySlugOrId = cache(
  async (slugOrId: string): Promise<PopulatedPost | undefined> => {
    const post = isUUID(slugOrId)
      ? await postService.getPostById(slugOrId)
      : await postService.getPostBySlug(slugOrId);
    return visibleToViewer(post);
  }
);
