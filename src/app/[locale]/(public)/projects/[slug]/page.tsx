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

  return <ProjectDetailClient slug={slug} initialPost={initialPost} />;
}
