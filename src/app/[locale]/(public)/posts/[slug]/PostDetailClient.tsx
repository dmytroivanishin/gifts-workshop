"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Loader2, ZoomIn, Link as LinkIcon, Globe, Phone, MessageCircle } from "lucide-react";
import { FaTelegramPlane, FaInstagram, FaVk, FaEnvelope, FaPinterest, FaWhatsapp, FaFacebook, FaLinkedin } from "react-icons/fa";
import { motion } from "framer-motion";
import { useGetPostByIdQuery } from "@/store/api";
import { useTranslation } from "@/i18n";
import { CommentSection } from "@/components/features/comments/CommentSection";
import { FullscreenGallery } from "@/components/shared/FullscreenGallery";
import { MEDIA_PLACEHOLDER_DATA_URL, handleImageLoadError } from "@/utils/mediaPlaceholder";
import { PopulatedPost } from "@/types";

interface PostDetailClientProps {
  slug: string;
  initialPost: PopulatedPost | undefined;
}

export default function PostDetailClient({ slug, initialPost }: PostDetailClientProps) {
  const { t, loc } = useTranslation();

  const { data: response, isLoading } = useGetPostByIdQuery(slug);
  // Prefer the live RTK Query result once it arrives (same source of truth as before); until then,
  // fall back to what the server already fetched for this exact slug, so the first paint — including
  // the HTML a crawler sees before any JS runs — shows the real post instead of a spinner.
  const post = response?.data ?? initialPost;

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  if (isLoading && !post) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-6 py-20 text-center max-w-[600px]">
        <h2 className="font-heading text-2xl font-semibold mb-4">
          {t('post_not_found')}
        </h2>
        <p className="text-muted-foreground mb-8">
          {t('post_not_found_desc')}
        </p>
        <Link href="/" className="inline-flex items-center text-primary font-medium hover:underline">
          <ChevronLeft size={20} className="mr-1" />
          {t('back_to_home')}
        </Link>
      </div>
    );
  }

  // Every posts_to_media entry is kept, even one whose media relation didn't resolve — a
  // deliberately defended, practically unreachable case (a media row can't be deleted while a post
  // still uses it, see MediaService.deleteMedia's 409 MEDIA_IN_USE), same spirit as the
  // post.category guard below. thumbnailUrl and originalUrl are always set together (both the real
  // upload pipeline and MediaService.saveMedia's external-URL path back-fill one from the other), so
  // a missing thumbnailUrl means there's no real originalUrl to fall back to either — straight to
  // the themed placeholder instead of chaining both fields.
  const galleryMedia = post.media.map((m) => m.media);
  const images = galleryMedia.map((m) => m?.originalUrl || MEDIA_PLACEHOLDER_DATA_URL);

  // A Draft/Archived post can legitimately have no category (postSchema only requires one for
  // Published); an admin previewing such a post by its public URL must not crash on it.
  const categoryTitle = post.category ? loc(post.category.title) : null;
  const categoryColor = post.category?.color!.color;

  const handleImageClick = (index: number) => {
    setInitialImageIndex(index);
    setGalleryOpen(true);
  };

  let socialLinks: Array<{name: string, link: string, icon: string}> = [];
  try {
    socialLinks = JSON.parse(process.env.NEXT_PUBLIC_SOCIAL_LINKS || '[]');
  } catch {
    console.error("Failed to parse NEXT_PUBLIC_SOCIAL_LINKS");
  }

  const ICON_MAP: Record<string, ComponentType<{ size?: number }>> = {
    telegram: FaTelegramPlane,
    instagram: FaInstagram,
    vk: FaVk,
    email: FaEnvelope,
    pinterest: FaPinterest,
    whatsapp: FaWhatsapp,
    facebook: FaFacebook,
    linkedin: FaLinkedin,
    website: Globe,
    phone: Phone,
    messenger: MessageCircle,
  };

  return (
    <article className="container mx-auto px-6 py-10 max-w-[1280px] font-sans">
      {/* Back Button */}
      <Link
        href="/"
        className="inline-flex items-center text-muted-foreground hover:text-foreground font-medium mb-10 transition-colors"
      >
        <ChevronLeft size={20} className="mr-1" />
        {t("back_to_gallery")}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Masonry Grid of Images */}
        <div className="lg:col-span-7">
          {images.length > 0 ? (
            <div className="columns-1 sm:columns-2 gap-4">
              {galleryMedia.map((mediaItem, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  key={index}
                  className="mb-4 overflow-hidden rounded-2xl bg-muted relative group cursor-pointer break-inside-avoid"
                  onClick={() => handleImageClick(index)}
                >
                  <Image
                    src={mediaItem?.thumbnailUrl || MEDIA_PLACEHOLDER_DATA_URL}
                    onError={handleImageLoadError}
                    alt={`${loc(post.title)} - ${index + 1}`}
                    width={mediaItem?.width || 400}
                    height={mediaItem?.height || 400}
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Overlay for hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="bg-white/90 backdrop-blur-sm p-3 rounded-full text-foreground shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                      <ZoomIn size={20} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="aspect-video w-full rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
              {t('no_images')}
            </div>
          )}
        </div>

        {/* Right Column: Metadata, Description & Inquiries */}
        <div className="lg:col-span-5 flex flex-col justify-start">
          <div className="sticky top-24 space-y-6">
            {/* Category & Availability */}
            <div className="flex items-center gap-3">
              {post.category && (
                <span
                  style={{
                    backgroundColor: `${categoryColor}15`,
                    color: categoryColor,
                    border: `1px solid ${categoryColor}30`,
                  }}
                  className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                >
                  {categoryTitle}
                </span>
              )}

              <div className={`px-4 py-1.5 rounded-full text-sm font-medium border ${post.inStock ? "bg-[#DADFC6] border-[#DADFC6] text-[#5C6535]" : "bg-white border-[#DADFC6] text-[#5C6535]"}`}>
                {post.inStock ? t("in_stock") : t("on_request")}
              </div>
            </div>

            {/* Title */}
            <h1 className="font-serif text-4xl lg:text-5xl font-medium leading-tight text-foreground">
              {loc(post.title)}
            </h1>

            {/* Description */}
            <p className="font-sans text-base text-muted-foreground leading-relaxed whitespace-pre-line">
              {loc(post.description)}
            </p>

            {/* Tags (if any) */}
            {post.tags && post.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-2" aria-label="Tags">
                {post.tags.map((tag, index) => {
                  const name = loc(tag.name);
                  return (
                    <li
                      key={index}
                      className="px-2.5 py-1 bg-secondary text-muted-foreground rounded-full text-xs font-medium"
                    >
                      #{name}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Contact Panel */}
            <aside className="pt-8 border-t border-border space-y-4">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                {t("contact_title")}
              </h2>

              <div className="flex flex-wrap gap-3">
                {socialLinks.map((social, idx) => {
                  const iconKey = social.icon.toLowerCase();
                  const IconComponent = ICON_MAP[iconKey] || LinkIcon;
                  return (
                    <a
                      key={idx}
                      href={social.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={social.name}
                      className="w-12 h-12 flex items-center justify-center rounded-full bg-secondary border border-border text-muted-foreground hover:bg-secondary/70 transition-colors shrink-0"
                    >
                      <IconComponent size={20} />
                    </a>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Comment Section */}
      <CommentSection postId={post.id} />

      {/* Fullscreen Gallery */}
      <FullscreenGallery
        images={images}
        initialIndex={initialImageIndex}
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
      />
    </article>
  );
}
