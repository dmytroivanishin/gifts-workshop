"use client";

import { useState, useEffect } from "react";
import { Heart, ChevronRight, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Post, PopulatedPost } from "@/types";
import Link from "next/link";
import { useTranslation } from "@/i18n";

interface ProjectCardProps {
  post: PopulatedPost;
  className?: string;
  onLikeToggle?: (id: string, liked: boolean) => void;
  onCategorySelect?: (categoryId?: string) => void;
}

export function ProjectCard({ post, className, onLikeToggle, onCategorySelect }: ProjectCardProps) {
  const { t, loc } = useTranslation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const liked = localStorage.getItem("liked_projects");
      if (liked) {
        const ids = JSON.parse(liked) as string[];
        setIsLiked(ids.includes(post.id));
      }
    }
  }, [post.id]);

  const mediaItems = [...(post.media || [])].sort((a, b) => {
    if (a.mediaId === post.posterId) return -1;
    if (b.mediaId === post.posterId) return 1;
    return a.order - b.order;
  });
  const totalImages = mediaItems.length;
  
  const categoryTitle = loc(post.category.title);
  const categoryColor = post.category.color!.color;

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % totalImages);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + totalImages) % totalImages);
  };

  const toggleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const liked = localStorage.getItem("liked_projects");
    let ids: string[] = [];
    if (liked) {
      ids = JSON.parse(liked) as string[];
    }
    
    let nextLiked = !isLiked;
    if (nextLiked) {
      if (!ids.includes(post.id)) ids.push(post.id);
    } else {
      ids = ids.filter((id) => id !== post.id);
    }
    
    localStorage.setItem("liked_projects", JSON.stringify(ids));
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
        "group relative flex flex-col overflow-hidden cursor-pointer mb-10 break-inside-avoid bg-transparent",
        className
      )}
    >
      <Link href={`/projects/${post.slug || post.id}`} className="block">
        {/* Image Gallery */}
        <div className="relative aspect-square w-full overflow-hidden bg-muted rounded-2xl">
          <AnimatePresence initial={false}>
            {totalImages > 0 ? (
              (() => {
                const currentMedia = mediaItems[currentImageIndex];
                const med = currentMedia?.media;
                const pos = currentMedia?.position;
                
                const isPortrait = med?.orientation === "Portrait" || (med?.height && med?.width && med.height > med.width);
                const isLandscape = med?.orientation === "Landscape" || (med?.height && med?.width && med.width > med.height);

                return (
                  <motion.img
                    key={currentImageIndex}
                    src={med?.originalUrl || ""}
                    alt={loc(post.title)}
                    className="absolute transition-transform duration-700 ease-out group-hover:scale-103"
                    style={{
                      left: "50%",
                      top: "50%",
                      width: isPortrait ? "100%" : (isLandscape ? "auto" : "100%"),
                      height: isLandscape ? "100%" : (isPortrait ? "auto" : "100%"),
                      minWidth: "100%",
                      minHeight: "100%",
                      transformOrigin: "center center",
                      transform: pos 
                        ? `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${pos.zoom})` 
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
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-md z-10 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-md z-10 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
              
              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1 z-10">
                {mediaItems.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-300",
                      idx === currentImageIndex ? "bg-white/95 scale-110" : "bg-white/45"
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
          <div className="flex items-center justify-between mb-3">
            <span
              style={{
                backgroundColor: `${categoryColor}15`,
                color: categoryColor,
                border: `1px solid ${categoryColor}30`,
              }}
              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onCategorySelect) {
                  onCategorySelect(post.category.id);
                }
              }}
            >
              {categoryTitle}
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleLike}
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
          <h3 className="font-serif text-[22px] font-medium leading-tight mb-2 text-foreground group-hover:text-primary transition-colors">
            {loc(post.title)}
          </h3>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
            {loc(post.description)}
          </p>

          {/* Action Button */}
          <div className="font-sans flex items-center text-sm font-medium transition-colors mt-auto" style={{ color: "#AFAA9E" }}>
            {t("view_project")}
            <ChevronRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
