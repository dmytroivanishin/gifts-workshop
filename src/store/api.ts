import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Post, Category, Tag, Collection, Localization, Media } from "@/types";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/v1" }),
  tagTypes: ["Post", "Category", "Tag", "Collection", "Localization", "Media"],
  endpoints: (builder) => ({
    getPosts: builder.query<{ data: Post[]; meta: any }, { search?: string; category?: string; inStock?: boolean }>({
      query: ({ search, category, inStock }) => {
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (category) params.append("category", category);
        if (inStock) params.append("inStock", "true");
        
        return {
          url: `/posts?${params.toString()}`,
        };
      },
      providesTags: ["Post"],
    }),
    getPostById: builder.query<{ data: Post }, string>({
      query: (id) => `/posts/${id}`,
      providesTags: (result, error, id) => [{ type: "Post", id }],
    }),
    createPost: builder.mutation<{ data: Post }, any>({
      query: (body) => ({
        url: "/posts",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Post", "Tag"],
    }),
    updatePost: builder.mutation<{ data: Post }, { id: string } & any>({
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
    getCategories: builder.query<{ data: Category[] }, void>({
      query: () => "/categories",
      providesTags: ["Category"],
    }),
    createCategory: builder.mutation<{ data: Category[] }, any>({
      query: (body) => ({
        url: "/categories",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Category"],
    }),
    getTags: builder.query<{ data: Tag[] }, void>({
      query: () => "/tags",
      providesTags: ["Tag"],
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
    getLocalizations: builder.query<{ data: Localization[] }, { entityId?: string; entityType?: string } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.entityId) queryParams.append("entityId", params.entityId);
        if (params?.entityType) queryParams.append("entityType", params.entityType);
        const queryStr = queryParams.toString();
        return `/localizations${queryStr ? `?${queryStr}` : ""}`;
      },
      providesTags: ["Localization"],
    }),
    saveLocalization: builder.mutation<{ data: Localization }, any>({
      query: (body) => ({
        url: "/localizations",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Localization", "Post", "Category"],
    }),
    getCollections: builder.query<{ data: Collection[] }, void>({
      query: () => "/collections",
      providesTags: ["Collection"],
    }),
    getMedia: builder.query<{ data: Media[] }, void>({
      query: () => "/media",
      providesTags: ["Media"],
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
  useCreateCategoryMutation,
  useGetTagsQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  useGetLocalizationsQuery,
  useSaveLocalizationMutation,
  useGetCollectionsQuery,
  useGetMediaQuery,
} = api;
