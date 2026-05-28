"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft, Send, MessageSquare, Mail, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useGetPostByIdQuery } from "@/store/api";
import { useTranslation } from "@/i18n";

interface ProjectDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { t, loc } = useTranslation();
  const { slug } = use(params);
  
  const { data: response, isLoading } = useGetPostByIdQuery(slug);
  const post = response?.data;

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
                  className="mb-4 overflow-hidden rounded-2xl bg-muted"
                >
                  <img
                    src={img}
                    alt={`${loc(post.title)} - ${index + 1}`}
                    className="w-full h-auto object-cover"
                  />
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
              
              <span
                style={{
                  backgroundColor: post.in_stock ? "#DADFC6" : "#E2E8F0",
                  color: post.in_stock ? "#5C6535" : "#4A5568",
                }}
                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              >
                {post.in_stock ? t("in_stock") : t("made_to_order")}
              </span>
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
                  const name = typeof tag === "string" ? tag : (tag.title?.ru || tag.title?.en || (typeof tag.title === "string" ? tag.title : ""));
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
              
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://t.me/dmytro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground font-sans text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Send size={16} />
                  Telegram
                </a>
                
                <a
                  href="https://wa.me/380000000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-secondary border border-border text-foreground font-sans text-sm font-medium hover:bg-secondary/70 transition-colors"
                >
                  <MessageSquare size={16} />
                  WhatsApp
                </a>

                <a
                  href="mailto:example@example.com"
                  className="p-3 rounded-full bg-secondary border border-border text-foreground hover:bg-secondary/70 transition-colors flex items-center justify-center"
                  title="Send Email"
                >
                  <Mail size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
