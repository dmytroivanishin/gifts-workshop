import { isRejectedWithValue, isFulfilled, Middleware } from "@reduxjs/toolkit";
import { addNotification } from "../slices/notificationSlice";

// A rejected RTK Query action's payload shape depends on where the rejection came from: the
// server's own envelope ({data: {error: {...}}}), a raw FetchBaseQueryError ({error: {...}}),
// or (rarely) a plain string — this middleware is generic across every endpoint, so it has to
// handle whichever one shows up rather than assume the server envelope always applies.
type RejectionPayload =
  | string
  | { data?: { error?: { code?: string; message?: string } }; error?: { code?: string; message?: string }; code?: string; message?: string };

export const notificationMiddleware: Middleware =
  (api) => (next) => (action) => {

    // Handle RTK Query errors
    if (isRejectedWithValue(action)) {
      const payload = action.payload as RejectionPayload;
      const errorData = typeof payload === "string" ? payload : payload?.data?.error || payload?.error || payload;
      const errorCode = typeof errorData === "string" ? "UNKNOWN_ERROR" : errorData?.code || "UNKNOWN_ERROR";
      
      api.dispatch(
        addNotification({
          type: "error",
          messageKey: errorCode,
          details: typeof errorData === 'string' ? errorData : errorData?.message,
        })
      );
    }

    // Handle RTK Query successful mutations (e.g. create, update, delete)
    const arg = isFulfilled(action) ? (action.meta?.arg as { endpointName?: string } | undefined) : undefined;
    if (arg?.endpointName) {
      const endpoint = arg.endpointName;
      
      // Map specific mutation endpoints to success message keys
      const successMap: Record<string, string> = {
        createPost: "post_created",
        updatePost: "post_updated",
        deletePost: "post_deleted",
        createCategory: "category_created",
        updateCategory: "category_updated",
        deleteCategory: "category_deleted",
        reorderCategories: "category_updated",
        createTag: "tag_created",
        updateTag: "tag_updated",
        deleteTag: "tag_deleted",
        createPage: "page_created",
        updatePage: "page_updated",
        deletePage: "page_deleted",
        createCollection: "collection_created",
        updateCollection: "collection_updated",
        deleteCollection: "collection_deleted",
      };

      if (successMap[endpoint]) {
        api.dispatch(
          addNotification({
            type: "success",
            messageKey: successMap[endpoint],
          })
        );
      }
    }

    return next(action);
  };
