import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { Post, Category, Tag, Collection, Media, PopulatedPost, PopulatedCategory, Language, SystemText } from "@/types";

const baseQuery = fetchBaseQuery({ 
  baseUrl: "/api/v1",
  credentials: "include" 
});

let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);
  
  if (!result.error || result.error.status !== 401) {
    return result;
  }

  if (isRefreshing) {
    await refreshPromise;
    return baseQuery(args, api, extraOptions);
  }

  isRefreshing = true;
  refreshPromise = baseQuery({
    url: '/auth/refresh',
    method: 'POST',
  }, api, extraOptions) as Promise<any>;
  
  const refreshResult = await refreshPromise;
  
  isRefreshing = false;
  refreshPromise = null;

  if (refreshResult.data) {
    return baseQuery(args, api, extraOptions);
  } 
  
  if (typeof window !== 'undefined') {
    window.location.href = '/admin/login';
  }
  
  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Post", "Category", "Tag", "Collection", "Media", "Color", "Language", "SystemText", "Comment"],
  endpoints: (builder) => ({
    getPosts: builder.query<{ data: PopulatedPost[]; meta: any }, { search?: string; category?: string; inStock?: boolean; status?: string; page?: number; limit?: number; populate?: string } | void>({
      query: (params) => {
        const urlParams = new URLSearchParams();
        if (params?.search) urlParams.append("search", params.search);
        if (params?.category) urlParams.append("category", params.category);
        if (params?.inStock) urlParams.append("inStock", "true");
        if (params?.status) urlParams.append("status", params.status);
        if (params?.page) urlParams.append("page", params.page.toString());
        if (params?.limit) urlParams.append("limit", params.limit.toString());
        if (params?.populate) urlParams.append("populate", params.populate);
        
        return {
          url: `/posts?${urlParams.toString()}`,
        };
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
    getCategories: builder.query<{ data: PopulatedCategory[]; meta: any }, { page?: number; limit?: number; populate?: string } | void>({
      query: (params) => {
        const urlParams = new URLSearchParams();
        if (params?.page) urlParams.append("page", params.page.toString());
        if (params?.limit) urlParams.append("limit", params.limit.toString());
        if (params?.populate) urlParams.append("populate", params.populate);
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
    getTags: builder.query<{ data: Tag[]; meta: any }, { page?: number; limit?: number } | void>({
      query: (params) => {
        const urlParams = new URLSearchParams();
        if (params?.page) urlParams.append("page", params.page.toString());
        if (params?.limit) urlParams.append("limit", params.limit.toString());
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
      invalidatesTags: (result, error, { id }) => ["Tag", "Post"],
    }),
    deleteTag: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/tags/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Tag", "Post"],
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
     getCollections: builder.query<{ data: Collection[]; meta: any }, { page?: number; limit?: number } | void>({
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
       invalidatesTags: (result, error, { id }) => ["Collection", "Post", "Category"],
     }),
     deleteCollection: builder.mutation<{ success: boolean }, string>({
       query: (id) => ({
         url: `/collections/${id}`,
         method: "DELETE",
       }),
       invalidatesTags: ["Collection", "Post", "Category"],
     }),
     getMedia: builder.query<{ data: Media[] }, void>({
       query: () => "/media",
       providesTags: ["Media"],
     }),
     getColors: builder.query<{ data: { id: string; color: string }[] }, void>({
       query: () => "/colors",
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
     getLanguages: builder.query<{ data: Language[]; meta: any }, { page?: number; limit?: number } | void>({
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
     getSystemTexts: builder.query<{ data: SystemText[]; meta: any }, { page?: number; limit?: number } | void>({
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
     getAdminComments: builder.query<{ data: any[]; meta: any }, { page?: number; limit?: number; postId?: string; status?: string } | void>({
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
     updateCommentStatus: builder.mutation<{ data: any }, { id: string; status: string }>({
       query: ({ id, status }) => ({
         url: `/admin/comments/${id}/status`,
         method: "PATCH",
         body: { status },
       }),
       invalidatesTags: ["Comment", "Post"],
     }),
     replyToComment: builder.mutation<{ data: any }, { id: string; text: string; name?: string }>({
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
     createPublicComment: builder.mutation<{ data: any }, { postId: string; name: string; text: string }>({
       query: ({ postId, ...body }) => ({
         url: `/posts/${postId}/comments`,
         method: "POST",
         body,
       }),
     }),
     getPublicComments: builder.query<{ data: any[]; meta: any }, { postId: string; page?: number; limit?: number }>({
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
