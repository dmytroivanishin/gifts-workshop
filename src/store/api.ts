import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Post, Category, Tag, Collection, Media, PopulatedPost, PopulatedCategory } from "@/types";
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/v1" }),
  tagTypes: ["Post", "Category", "Tag", "Collection", "Media"],
  endpoints: (builder) => ({
    getPosts: builder.query<{ data: PopulatedPost[]; meta: any }, { search?: string; category?: string; inStock?: boolean }>({
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
    getCategories: builder.query<{ data: PopulatedCategory[] }, void>({
      query: () => "/categories",
      providesTags: ["Category"],
    }),
    createCategory: builder.mutation<{ data: PopulatedCategory[] }, any>({
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
    updateCategory: builder.mutation<{ data: PopulatedCategory }, { id: string } & any>({
      query: ({ id, ...body }) => ({
        url: `/categories/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Category", "Post"],
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
  useUpdateCategoryMutation,
  useGetTagsQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  useGetCollectionsQuery,
  useGetMediaQuery,
} = api;
