import { notFound } from "next/navigation";
import { getVisiblePostBySlugOrId } from "@/utils/postLookup";
import ProjectDetailClient from "./ProjectDetailClient";

interface ProjectDetailPageProps {
  params: Promise<{ slug: string }>;
}

// Server component: fetches the exact same post the layout's generateMetadata already fetched
// (React.cache()'d, so it's one DB round trip, not two) and hands it to the client component as
// initial data. The client component is otherwise unchanged — same hook, same interactivity — this
// only replaces what renders before that hook's own fetch resolves, so the initial HTML (what a
// crawler or a view-source sees before any JS runs) already contains the real post.
export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { slug } = await params;
  const initialPost = await getVisiblePostBySlugOrId(slug);

  // getVisiblePostBySlugOrId already returns undefined for a genuinely missing slug AND for a
  // Draft/Archived post viewed by a non-admin (same rule the API uses, utils/postVisibility.ts),
  // so this was previously rendering ProjectDetailClient's own "not found" text with an HTTP 200 —
  // a soft 404 search engines penalize. notFound() here makes the response a real 404 instead,
  // using the project's existing not-found.tsx. An admin viewing the same URL still gets the post
  // (visibleToViewer lets admins see Draft/Archived), so this never fires for them.
  if (!initialPost) {
    notFound();
  }

  return <ProjectDetailClient slug={slug} initialPost={initialPost} />;
}
