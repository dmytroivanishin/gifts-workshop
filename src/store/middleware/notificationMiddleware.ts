import { isRejectedWithValue, isFulfilled, Middleware } from "@reduxjs/toolkit";
import { addNotification } from "../slices/notificationSlice";

export const notificationMiddleware: Middleware =
  (api) => (next) => (action: any) => {
    
    // Handle RTK Query errors
    if (isRejectedWithValue(action)) {
      const errorData = action.payload?.data?.error || action.payload?.error || action.payload;
      const errorCode = errorData?.code || "UNKNOWN_ERROR";
      
      api.dispatch(
        addNotification({
          type: "error",
          messageKey: errorCode,
          details: typeof errorData === 'string' ? errorData : errorData?.message,
        })
      );
    }

    // Handle RTK Query successful mutations (e.g. create, update, delete)
    if (isFulfilled(action) && action.meta?.arg?.endpointName) {
      const endpoint = action.meta.arg.endpointName as string;
      
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
