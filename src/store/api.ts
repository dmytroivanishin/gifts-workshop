import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { Post, Category, Tag, Collection, Media, PopulatedPost, PopulatedCategory } from "@/types";
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/v1" }),
  tagTypes: ["Post", "Category", "Tag", "Collection", "Media"],
  endpoints: (builder) => ({
    getPosts: builder.query<{ data: PopulatedPost[]; meta: any }, { search?: string; category?: string; inStock?: boolean; page?: number; limit?: number; populate?: string } | void>({
      query: (params) => {
        const urlParams = new URLSearchParams();
        if (params?.search) urlParams.append("search", params.search);
        if (params?.category) urlParams.append("category", params.category);
        if (params?.inStock) urlParams.append("inStock", "true");
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
   useCreateCollectionMutation,
   useUpdateCollectionMutation,
   useDeleteCollectionMutation,
   useGetMediaQuery,
 } = api;
