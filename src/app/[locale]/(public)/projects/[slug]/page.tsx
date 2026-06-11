"use client";

import { use, useState } from "react";
import Link from "next/link";
import * as LucideIcons from "lucide-react";
import { ChevronLeft, Loader2, ZoomIn } from "lucide-react";
import { FaTelegramPlane, FaInstagram, FaVk, FaEnvelope, FaPinterest, FaWhatsapp, FaFacebook, FaLinkedin } from "react-icons/fa";
import { motion } from "framer-motion";
import { useGetPostByIdQuery } from "@/store/api";
import { useTranslation } from "@/i18n";
import { CommentSection } from "@/components/features/comments/CommentSection";
import { FullscreenGallery } from "@/components/shared/FullscreenGallery";

interface ProjectDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { t, loc } = useTranslation();
  const { slug } = use(params);
  
  const { data: response, isLoading } = useGetPostByIdQuery(slug);
  const post = response?.data;

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-6 py-20 text-center max-w-[600px]">
        <h2 className="font-heading text-2xl font-semibold mb-4">Работа не найдена</h2>
        <p className="text-muted-foreground mb-8">Запрошенный проект не существует или был удален.</p>
        <Link href="/" className="inline-flex items-center text-primary font-medium hover:underline">
          <ChevronLeft size={20} className="mr-1" />
          Вернуться на главную
        </Link>
      </div>
    );
  }

  const images = post.media
    .map((m) => m.media?.originalUrl)
    .filter((url): url is string => typeof url === "string");
  
  const categoryTitle = loc(post.category.title);
  const categoryColor = post.category.color!.color;

  const handleImageClick = (index: number) => {
    setInitialImageIndex(index);
    setGalleryOpen(true);
  };

  let socialLinks: Array<{name: string, link: string, icon: string}> = [];
  try {
    socialLinks = JSON.parse(process.env.NEXT_PUBLIC_SOCIAL_LINKS || '[]');
  } catch (e) {
    console.error("Failed to parse NEXT_PUBLIC_SOCIAL_LINKS");
  }

  const ICON_MAP: Record<string, any> = {
    telegram: FaTelegramPlane,
    instagram: FaInstagram,
    vk: FaVk,
    email: FaEnvelope,
    pinterest: FaPinterest,
    whatsapp: FaWhatsapp,
    facebook: FaFacebook,
    linkedin: FaLinkedin,
  };

  return (
    <div className="container mx-auto px-6 py-10 max-w-[1280px] font-sans">
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
              {images.map((img, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  key={index}
                  className="mb-4 overflow-hidden rounded-2xl bg-muted relative group cursor-pointer break-inside-avoid"
                  onClick={() => handleImageClick(index)}
                >
                  <img
                    src={img}
                    alt={`${loc(post.title)} - ${index + 1}`}
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
              Нет изображений
            </div>
          )}
        </div>

        {/* Right Column: Metadata, Description & Inquiries */}
        <div className="lg:col-span-5 flex flex-col justify-start">
          <div className="sticky top-24 space-y-6">
            {/* Category & Availability */}
            <div className="flex items-center gap-3">
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
              
              <div className={`px-4 py-1.5 rounded-full text-sm font-medium border ${post.inStock ? "bg-[#DADFC6] border-[#DADFC6] text-[#5C6535]" : "bg-white border-[#DADFC6] text-[#5C6535]"}`}>
                {post.inStock ? t("in_stock") : t("on_request")}
              </div>
            </div>

            {/* Title */}
            <h1 className="font-serif text-4xl lg:text-5xl font-medium leading-tight text-foreground">
              {loc(post.title)}
            </h1>

            {/* Description */}
            <div className="font-sans text-base text-muted-foreground leading-relaxed whitespace-pre-line">
              {loc(post.description)}
            </div>

            {/* Tags (if any) */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {post.tags.map((tag, index) => {
                  const name = loc(tag.name);
                  return (
                    <span
                      key={index}
                      className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium"
                    >
                      #{name}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Contact Panel */}
            <div className="pt-8 border-t border-border space-y-4">
              <h3 className="font-heading text-lg font-semibold text-foreground">
                {t("contact_title")}
              </h3>
              
              <div className="flex flex-wrap gap-3">
                {socialLinks.map((social, idx) => {
                  const iconKey = social.icon.toLowerCase();
                  const IconComponent = ICON_MAP[iconKey] || (LucideIcons as any)[social.icon] || LucideIcons.Link;
                  return (
                    <a
                      key={idx}
                      href={social.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={social.name}
                      className="w-12 h-12 flex items-center justify-center rounded-full bg-secondary border border-border text-foreground hover:bg-secondary/70 transition-colors shrink-0"
                    >
                      <IconComponent size={20} />
                    </a>
                  );
                })}
              </div>
            </div>
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
    </div>
  );
}

