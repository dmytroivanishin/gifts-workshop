import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { Page, Tag, Collection, Media, PopulatedPost, PopulatedCategory, Language, SystemText, Comment, PopulatedComment } from "@/types";

type PaginationMeta = { page: number; nextPage: number | null; prevPage: number | null; totalItems: number };

const baseQuery = fetchBaseQuery({
  baseUrl: "/api/v1",
  credentials: "include"
});

// Set from the server-rendered root layout (see ContentVersion). The public site adds it to GET
// URLs so the browser's long-lived cache is bypassed the moment content changes.
let contentVersion: string | null = null;
export function setContentVersion(value: string): void {
  contentVersion = value;
}

// Admin works in real time: no browser cache at all. Public keeps the browser cache, keyed by version.
const cachingBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = (args, api, extraOptions) => {
  const request: FetchArgs = typeof args === "string" ? { url: args } : { ...args };
  const isGet = !request.method || request.method.toUpperCase() === "GET";
  if (isGet && typeof window !== "undefined") {
    if (window.location.pathname.startsWith("/admin")) {
      request.cache = "no-store";
    } else if (contentVersion) {
      request.url += (request.url.includes("?") ? "&" : "?") + `v=${contentVersion}`;
    }
  }
  return baseQuery(request, api, extraOptions);
};

let isRefreshing = false;
let refreshPromise: ReturnType<typeof baseQuery> | null = null;

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  const result = await cachingBaseQuery(args, api, extraOptions);
  
  if (!result.error || result.error.status !== 401) {
    return result;
  }

  if (isRefreshing) {
    await refreshPromise;
    return cachingBaseQuery(args, api, extraOptions);
  }

  isRefreshing = true;
  refreshPromise = baseQuery({
    url: '/auth/refresh',
    method: 'POST',
  }, api, extraOptions);
  
  const refreshResult = await refreshPromise;
  
  isRefreshing = false;
  refreshPromise = null;

  if (refreshResult.data) {
    return cachingBaseQuery(args, api, extraOptions);
  } 
  
  if (typeof window !== 'undefined') {
    window.location.href = '/admin/login';
  }
  
  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Post", "Category", "Tag", "Collection", "Media", "Color", "Language", "SystemText", "Comment", "Page"],
  endpoints: (builder) => ({
    getPosts: builder.query<{ data: PopulatedPost[]; meta: PaginationMeta }, { search?: string; category?: string; inStock?: boolean; status?: string; page?: number; limit?: number } | void>({
      query: (params) => {
        const urlParams = new URLSearchParams();
        if (params?.search) urlParams.append("search", params.search);
        if (params?.category) urlParams.append("category", params.category);
        if (params?.inStock) urlParams.append("inStock", "true");
        if (params?.status) urlParams.append("status", params.status);
        if (params?.page) urlParams.append("page", params.page.toString());
        if (params?.limit) urlParams.append("limit", params.limit.toString());
        
        return {
          url: `/posts?${urlParams.toString()}`,
        };
      },
      serializeQueryArgs: ({ queryArgs }) => {
        if (!queryArgs) return {};
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- deliberately excluding page from the cache key, not using it.
        const { page, ...rest } = queryArgs;
        return rest; // Group cache by filters, ignoring page number
      },
      merge: (currentCache, newItems, { arg }) => {
        if (!arg || !arg.page || arg.page === 1) {
          return newItems;
        }
        
        // Prevent duplicates when merging
        const existingIds = new Set(currentCache.data.map((p) => p.id));
        const uniqueNewItems = newItems.data.filter((p) => !existingIds.has(p.id));
        
        currentCache.data.push(...uniqueNewItems);
        currentCache.meta = newItems.meta;
      },
      forceRefetch({ currentArg, previousArg }) {
        return currentArg?.page !== previousArg?.page;
      },
      providesTags: ["Post"],
    }),
    getPostById: builder.query<{ data: PopulatedPost }, string>({
      query: (id) => `/posts/${id}`,
      providesTags: (result, error, id) => [{ type: "Post", id }],
    }),
    createPost: builder.mutation<{ data: PopulatedPost }, any>({
      query: (body) => ({
        url: "/posts",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Post", "Tag"],
    }),
    updatePost: builder.mutation<{ data: PopulatedPost }, { id: string } & any>({
      query: ({ id, ...body }) => ({
        url: `/posts/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { id }) => ["Post", { type: "Post", id }, "Tag"],
    }),
    deletePost: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/posts/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Post"],
    }),
    getCategories: builder.query<{ data: PopulatedCategory[]; meta: PaginationMeta }, { page?: number; limit?: number } | void>({
      query: (params) => {
        const urlParams = new URLSearchParams();
        if (params?.page) urlParams.append("page", params.page.toString());
        if (params?.limit) urlParams.append("limit", params.limit.toString());
        return {
          url: `/categories?${urlParams.toString()}`,
        };
      },
      providesTags: ["Category"],
    }),
    getCategoryById: builder.query<{ data: PopulatedCategory }, string>({
      query: (id) => `/categories/${id}`,
      providesTags: (result, error, id) => [{ type: "Category", id }],
    }),
    createCategory: builder.mutation<{ data: PopulatedCategory[] }, any>({
      query: (body) => ({
        url: "/categories",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Category"],
    }),
    getTags: builder.query<{ data: Tag[]; meta: PaginationMeta }, { page?: number; limit?: number; search?: string } | void>({
      query: (params) => {
        const urlParams = new URLSearchParams();
        if (params?.page) urlParams.append("page", params.page.toString());
        if (params?.limit) urlParams.append("limit", params.limit.toString());
        if (params?.search) urlParams.append("search", params.search);
        return {
          url: `/tags?${urlParams.toString()}`,
        };
      },
      providesTags: ["Tag"],
    }),
    getTagById: builder.query<{ data: Tag }, string>({
      query: (id) => `/tags/${id}`,
      providesTags: (result, error, id) => [{ type: "Tag", id }],
    }),
    createTag: builder.mutation<{ data: Tag }, any>({
      query: (body) => ({
        url: "/tags",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Tag"],
    }),
    updateTag: builder.mutation<{ data: Tag }, { id: string } & any>({
      query: ({ id, ...body }) => ({
        url: `/tags/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Tag", "Post"],
    }),
    deleteTag: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/tags/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Tag", "Post"],
    }),
    getPages: builder.query<{ data: Page[] }, void>({
      query: () => "/pages",
      providesTags: ["Page"],
    }),
    getPageById: builder.query<{ data: Page }, string>({
      query: (id) => `/pages/${id}`,
      providesTags: (result, error, id) => [{ type: "Page", id }, "Page"],
    }),
    createPage: builder.mutation<{ data: Page }, Partial<Page>>({
      query: (body) => ({ url: "/pages", method: "POST", body }),
      invalidatesTags: ["Page"],
    }),
    updatePage: builder.mutation<{ data: Page }, { id: string } & Partial<Page>>({
      query: ({ id, ...body }) => ({ url: `/pages/${id}`, method: "PUT", body }),
      invalidatesTags: ["Page"],
    }),
    deletePage: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({ url: `/pages/${id}`, method: "DELETE" }),
      invalidatesTags: ["Page"],
    }),
    // Suggests a URL slug for a title (admin only); a mutation because it is a POST that must not be cached.
    generateSlug: builder.mutation<{ data: { slug: string } }, { text: string }>({
      query: (body) => ({ url: "/slugs", method: "POST", body }),
    }),
    updateCategory: builder.mutation<{ data: PopulatedCategory }, { id: string } & any>({
      query: ({ id, ...body }) => ({
        url: `/categories/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Category", "Post"],
    }),
    deleteCategory: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Category", "Post"],
    }),
    reorderCategories: builder.mutation<{ success: boolean }, { id: string; order: number }[]>({
      query: (items) => ({
        url: `/categories/reorder`,
        method: "PUT",
        body: { items },
      }),
      invalidatesTags: ["Category"],
    }),
     getCollections: builder.query<{ data: Collection[]; meta: PaginationMeta }, { page?: number; limit?: number } | void>({
       query: (params) => {
         const urlParams = new URLSearchParams();
         if (params?.page) urlParams.append("page", params.page.toString());
         if (params?.limit) urlParams.append("limit", params.limit.toString());
         return {
           url: `/collections?${urlParams.toString()}`,
         };
       },
       providesTags: ["Collection"],
     }),
     getCollectionById: builder.query<{ data: Collection }, string>({
       query: (id) => `/collections/${id}`,
       providesTags: (result, error, id) => [{ type: "Collection", id }],
     }),
     createCollection: builder.mutation<{ data: Collection }, any>({
       query: (body) => ({
         url: "/collections",
         method: "POST",
         body,
       }),
       invalidatesTags: ["Collection"],
     }),
     updateCollection: builder.mutation<{ data: Collection }, { id: string } & any>({
       query: ({ id, ...body }) => ({
         url: `/collections/${id}`,
         method: "PUT",
         body,
       }),
       invalidatesTags: ["Collection", "Post", "Category"],
     }),
     deleteCollection: builder.mutation<{ success: boolean }, string>({
       query: (id) => ({
         url: `/collections/${id}`,
         method: "DELETE",
       }),
       invalidatesTags: ["Collection", "Post", "Category"],
     }),
     getMedia: builder.query<{ data: Media[] }, { search?: string } | void>({
       query: (params) => {
         const urlParams = new URLSearchParams();
         if (params?.search) urlParams.append("search", params.search);
         const qs = urlParams.toString();
         return qs ? `/media?${qs}` : "/media";
       },
       providesTags: ["Media"],
     }),
     uploadMedia: builder.mutation<{ data: Media }, FormData>({
       query: (formData) => ({
         url: "/media",
         method: "POST",
         body: formData,
       }),
       invalidatesTags: ["Media"],
     }),
     deleteMedia: builder.mutation<{ success: boolean }, string>({
       query: (id) => ({
         url: `/media/${id}`,
         method: "DELETE",
       }),
       invalidatesTags: ["Media"],
     }),
     bulkDeleteMedia: builder.mutation<{ data: { deleted: string[]; blocked: { id: string; reason: string }[] } }, string[]>({
       query: (ids) => ({
         url: "/media/bulk-delete",
         method: "POST",
         body: { ids },
       }),
       invalidatesTags: ["Media"],
     }),
     getColors: builder.query<{ data: { id: string; color: string }[] }, { page?: number; limit?: number } | void>({
       query: (params) => {
         const urlParams = new URLSearchParams();
         if (params?.page) urlParams.append("page", params.page.toString());
         if (params?.limit) urlParams.append("limit", params.limit.toString());
         return {
           url: `/colors?${urlParams.toString()}`,
         };
       },
       providesTags: ["Color"],
     }),
     createColor: builder.mutation<{ data: { id: string; color: string } }, any>({
       query: (body) => ({
         url: "/colors",
         method: "POST",
         body,
       }),
       invalidatesTags: ["Color"],
     }),
     updateColor: builder.mutation<{ data: { id: string; color: string } }, { id: string; color: string }>({
       query: ({ id, ...body }) => ({
         url: `/colors/${id}`,
         method: "PUT",
         body,
       }),
       invalidatesTags: ["Color", "Category"],
     }),
     deleteColor: builder.mutation<{ success: boolean }, string>({
       query: (id) => ({
         url: `/colors/${id}`,
         method: "DELETE",
       }),
       invalidatesTags: ["Color", "Category"],
     }),
     getLanguages: builder.query<{ data: Language[]; meta: PaginationMeta }, { page?: number; limit?: number } | void>({
       query: (params) => {
         const urlParams = new URLSearchParams();
         if (params?.page) urlParams.append("page", params.page.toString());
         if (params?.limit) urlParams.append("limit", params.limit.toString());
         return {
           url: `/languages?${urlParams.toString()}`,
         };
       },
       providesTags: ["Language"],
     }),
     getLanguageById: builder.query<{ data: Language }, string>({
       query: (id) => `/languages/${id}`,
       providesTags: (result, error, id) => [{ type: "Language", id }],
     }),
     createLanguage: builder.mutation<{ data: Language }, any>({
       query: (body) => ({
         url: "/languages",
         method: "POST",
         body,
       }),
       invalidatesTags: ["Language"],
     }),
     updateLanguage: builder.mutation<{ data: Language }, { id: string } & any>({
       query: ({ id, ...body }) => ({
         url: `/languages/${id}`,
         method: "PATCH",
         body,
       }),
       invalidatesTags: (result, error, { id }) => ["Language", { type: "Language", id }],
     }),
     deleteLanguage: builder.mutation<{ success: boolean }, string>({
       query: (id) => ({
         url: `/languages/${id}`,
         method: "DELETE",
       }),
       invalidatesTags: ["Language"],
     }),
     getSystemTexts: builder.query<{ data: SystemText[]; meta: PaginationMeta }, { page?: number; limit?: number } | void>({
       query: (params) => {
         const urlParams = new URLSearchParams();
         if (params?.page) urlParams.append("page", params.page.toString());
         if (params?.limit) urlParams.append("limit", params.limit.toString());
         return {
           url: `/system-texts?${urlParams.toString()}`,
         };
       },
       providesTags: ["SystemText"],
     }),
     getSystemTextById: builder.query<{ data: SystemText }, string>({
       query: (id) => `/system-texts/${id}`,
       providesTags: (result, error, id) => [{ type: "SystemText", id }],
     }),
     createSystemText: builder.mutation<{ data: SystemText }, any>({
       query: (body) => ({
         url: "/system-texts",
         method: "POST",
         body,
       }),
       invalidatesTags: ["SystemText"],
     }),
     updateSystemText: builder.mutation<{ data: SystemText }, { id: string } & any>({
       query: ({ id, ...body }) => ({
         url: `/system-texts/${id}`,
         method: "PATCH",
         body,
       }),
       invalidatesTags: (result, error, { id }) => ["SystemText", { type: "SystemText", id }],
     }),
     deleteSystemText: builder.mutation<{ success: boolean }, string>({
       query: (id) => ({
         url: `/system-texts/${id}`,
         method: "DELETE",
       }),
       invalidatesTags: ["SystemText"],
     }),
     getAdminComments: builder.query<{ data: PopulatedComment[]; meta: PaginationMeta }, { page?: number; limit?: number; postId?: string; status?: string } | void>({
       query: (params) => {
         const urlParams = new URLSearchParams();
         if (params?.page) urlParams.append("page", params.page.toString());
         if (params?.limit) urlParams.append("limit", params.limit.toString());
         if (params?.postId) urlParams.append("postId", params.postId);
         if (params?.status) urlParams.append("status", params.status);
         return {
           url: `/admin/comments?${urlParams.toString()}`,
         };
       },
       providesTags: ["Comment"],
     }),
     updateCommentStatus: builder.mutation<{ data: Comment }, { id: string; status: string }>({
       query: ({ id, status }) => ({
         url: `/admin/comments/${id}/status`,
         method: "PATCH",
         body: { status },
       }),
       invalidatesTags: ["Comment", "Post"],
     }),
     replyToComment: builder.mutation<{ data: Comment }, { id: string; text: string; name?: string }>({
       query: ({ id, ...body }) => ({
         url: `/admin/comments/${id}/reply`,
         method: "POST",
         body,
       }),
       invalidatesTags: ["Comment", "Post"],
     }),
     deleteAdminComment: builder.mutation<{ success: boolean }, string>({
       query: (id) => ({
         url: `/admin/comments/${id}`,
         method: "DELETE",
       }),
       invalidatesTags: ["Comment", "Post"],
     }),
     createPublicComment: builder.mutation<{ data: Comment }, { postId: string; name: string; text: string }>({
       query: ({ postId, ...body }) => ({
         url: `/posts/${postId}/comments`,
         method: "POST",
         body,
       }),
     }),
     getPublicComments: builder.query<{ data: Comment[]; meta: PaginationMeta }, { postId: string; page?: number; limit?: number }>({
        query: ({ postId, page, limit }) => {
          const urlParams = new URLSearchParams();
          if (page) urlParams.append("page", page.toString());
          if (limit) urlParams.append("limit", limit.toString());
          const queryStr = urlParams.toString();
          return `/posts/${postId}/comments${queryStr ? `?${queryStr}` : ""}`;
        },
        providesTags: ["Comment"],
      }),
   }),
 });
 
 export const {
   useGetPostsQuery,
   useGetPostByIdQuery,
   useCreatePostMutation,
   useUpdatePostMutation,
   useDeletePostMutation,
   useGetCategoriesQuery,
   useGetCategoryByIdQuery,
   useCreateCategoryMutation,
   useUpdateCategoryMutation,
   useDeleteCategoryMutation,
   useReorderCategoriesMutation,
   useGenerateSlugMutation,
   useGetPagesQuery,
   useGetPageByIdQuery,
   useCreatePageMutation,
   useUpdatePageMutation,
   useDeletePageMutation,
   useGetTagsQuery,
   useGetTagByIdQuery,
   useCreateTagMutation,
   useUpdateTagMutation,
   useDeleteTagMutation,
   useGetCollectionsQuery,
   useGetCollectionByIdQuery,
   useCreateCollectionMutation,
   useUpdateCollectionMutation,
   useDeleteCollectionMutation,
   useGetMediaQuery,
   useUploadMediaMutation,
   useDeleteMediaMutation,
   useBulkDeleteMediaMutation,
   useGetColorsQuery,
   useCreateColorMutation,
   useUpdateColorMutation,
   useDeleteColorMutation,
   useGetLanguagesQuery,
   useGetLanguageByIdQuery,
   useCreateLanguageMutation,
   useUpdateLanguageMutation,
   useDeleteLanguageMutation,
   useGetSystemTextsQuery,
   useGetSystemTextByIdQuery,
   useCreateSystemTextMutation,
   useUpdateSystemTextMutation,
   useDeleteSystemTextMutation,
   useGetAdminCommentsQuery,
   useUpdateCommentStatusMutation,
   useReplyToCommentMutation,
   useDeleteAdminCommentMutation,
   useCreatePublicCommentMutation,
   useGetPublicCommentsQuery,
 } = api;
