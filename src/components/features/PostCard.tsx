"use client";

import { useState, useEffect, useRef } from "react";
import { Heart, ChevronRight, ChevronLeft } from "lucide-react";
import { InStockRibbon } from "@/components/features/InStockRibbon";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils/cn";
import { MEDIA_PLACEHOLDER_DATA_URL, handleImageLoadError } from "@/utils/mediaPlaceholder";
import { PopulatedPost } from "@/types";
import Link from "next/link";
import { useTranslation } from "@/i18n";

interface PostCardProps {
  post: PopulatedPost;
  className?: string;
  onLikeToggle?: (id: string, liked: boolean) => void;
  onCategorySelect?: (categoryId?: string) => void;
}

export function PostCard({ post, className, onLikeToggle, onCategorySelect }: PostCardProps) {
  const { t, loc } = useTranslation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const wasDraggedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const liked = localStorage.getItem("liked_posts");
      if (liked) {
        const ids = JSON.parse(liked) as string[];
        setIsLiked(ids.includes(post.id));
      }
    }
  }, [post.id]);

  const mediaItems = [...(post.media || [])].sort((first, second) => {
    if (first.mediaId === post.posterId) return -1;
    if (second.mediaId === post.posterId) return 1;
    return first.order - second.order;
  });
  const totalImages = mediaItems.length;
  
  // A Draft/Archived post can legitimately have no category (postSchema only requires one for
  // Published); not reachable today (this component only renders Published posts), but guard it
  // the same way PostDetailClient.tsx does rather than leave the same crash-prone pattern.
  const categoryTitle = post.category ? loc(post.category.title) : null;
  const categoryColor = post.category?.color!.color;

  const goToNext = () => setCurrentImageIndex((prev) => (prev + 1) % totalImages);
  const goToPrev = () => setCurrentImageIndex((prev) => (prev - 1 + totalImages) % totalImages);

  const nextImage = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    goToNext();
  };

  const prevImage = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    goToPrev();
  };

  const toggleLike = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const liked = localStorage.getItem("liked_posts");
    let ids: string[] = [];
    if (liked) {
      ids = JSON.parse(liked) as string[];
    }

    const nextLiked = !isLiked;
    if (nextLiked) {
      if (!ids.includes(post.id)) ids.push(post.id);
    } else {
      ids = ids.filter((id) => id !== post.id);
    }

    localStorage.setItem("liked_posts", JSON.stringify(ids));
    setIsLiked(nextLiked);
    
    if (onLikeToggle) {
      onLikeToggle(post.id, nextLiked);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "group relative flex flex-col cursor-pointer h-full bg-transparent",
        className
      )}
    >
      {/* Sits on the card root, outside the clipped image box, because the flap and the top of the body stick out above the photo */}
      {post.inStock && <InStockRibbon />}
      <Link href={`/posts/${post.slug || post.id}`} className="flex flex-col h-full">
        {/* Image Gallery */}
        <div className="relative aspect-square w-full overflow-hidden bg-muted rounded-2xl shrink-0">
          <AnimatePresence initial={false}>
            {totalImages > 0 ? (
              (() => {
                const currentMedia = mediaItems[currentImageIndex];
                const mediaFile = currentMedia?.media;
                const position = currentMedia?.position;
                
                const isPortrait = mediaFile?.orientation === "Portrait" || (mediaFile?.height && mediaFile?.width && mediaFile.height > mediaFile.width);
                const isLandscape = mediaFile?.orientation === "Landscape" || (mediaFile?.height && mediaFile?.width && mediaFile.width > mediaFile.height);

                return (
                  <motion.img
                    key={currentImageIndex}
                    // thumbnailUrl and originalUrl are always set together (the upload pipeline and
                    // MediaService.saveMedia's external-URL path both back-fill one from the other),
                    // so a missing thumbnailUrl means there's no real originalUrl to fall back to
                    // either — straight to the themed placeholder.
                    src={mediaFile?.thumbnailUrl || MEDIA_PLACEHOLDER_DATA_URL}
                    onError={handleImageLoadError}
                    alt={loc(post.title)}
                    // No `drag` here on purpose: this image already has its own manually-computed
                    // `style.transform` (pan/zoom position below), and framer-motion's drag system
                    // also drives `transform` to move the element — the two fought each other,
                    // producing a diagonal slide instead of a clean crossfade. `onPanEnd` detects
                    // the swipe gesture without framer touching the element's transform at all, so
                    // the only visible transition stays the existing opacity crossfade below.
                    onPanEnd={(_e, info) => {
                      if (totalImages > 1 && Math.abs(info.offset.x) > 50 && Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
                        wasDraggedRef.current = true;
                        if (info.offset.x < 0) goToNext();
                        else goToPrev();
                      }
                    }}
                    onClick={(event) => {
                      if (wasDraggedRef.current) {
                        event.preventDefault();
                        event.stopPropagation();
                        wasDraggedRef.current = false;
                      }
                    }}
                    className="absolute transition-transform duration-700 ease-out group-hover:scale-103"
                    style={{
                      left: position ? `calc(50% + ${position.x / 3}%)` : "50%",
                      top: position ? `calc(50% + ${position.y / 3}%)` : "50%",
                      width: isPortrait ? "100%" : (isLandscape ? "auto" : "100%"),
                      height: isLandscape ? "100%" : (isPortrait ? "auto" : "100%"),
                      minWidth: isPortrait ? "100%" : "auto",
                      minHeight: isLandscape ? "100%" : "auto",
                      maxWidth: "none",
                      maxHeight: "none",
                      touchAction: "pan-y",
                      transformOrigin: "center center",
                      transform: position
                        ? `translate(-50%, -50%) scale(${position.zoom})`
                        : 'translate(-50%, -50%) scale(1)'
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                );
              })()
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                No Image
              </div>
            )}
          </AnimatePresence>

          {/* Carousel Controls */}
          {totalImages > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 max-md:hidden pointer-coarse:hidden transition-opacity hover:bg-white shadow-md z-10 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 max-md:hidden pointer-coarse:hidden transition-opacity hover:bg-white shadow-md z-10 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
              
              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1 z-10">
                {mediaItems.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-300",
                      index === currentImageIndex ? "bg-white/95 scale-110" : "bg-white/45"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="pt-5 flex flex-col flex-1">
          {/* Meta row: Category Badge & Like Button */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            {post.category && (
              <span
                style={{
                  backgroundColor: `${categoryColor}15`,
                  color: categoryColor,
                  border: `1px solid ${categoryColor}30`,
                }}
                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (onCategorySelect) {
                    onCategorySelect(post.category!.id);
                  }
                }}
              >
                {categoryTitle}
              </span>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleLike}
              data-test-id="like-button"
              className="p-1 -mr-1 z-10 cursor-pointer"
            >
              <Heart
                size={22}
                className={cn(
                  "transition-colors duration-300",
                  isLiked ? "fill-heart-active text-heart-active" : "text-heart-outline hover:text-heart-active"
                )}
              />
            </motion.button>
          </div>

          {/* Title & Description */}
          <h3 className="font-serif text-[22px] font-medium leading-tight mb-2 text-foreground group-hover:text-primary transition-colors truncate shrink-0">
            {loc(post.title) || '\u00A0'}
          </h3>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2 min-h-[46px] shrink-0">
            {loc(post.description)}
          </p>

          {/* Action Button */}
          <div className="font-sans flex items-center text-sm font-medium transition-colors mt-auto" style={{ color: "#AFAA9E" }}>
            {t("view_post")}
            <ChevronRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
