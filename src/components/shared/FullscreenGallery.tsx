"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { handleImageLoadError } from "@/utils/mediaPlaceholder";
import { useTranslation } from "@/i18n";

interface FullscreenGalleryProps {
  images: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function FullscreenGallery({
  images,
  initialIndex,
  isOpen,
  onClose,
}: FullscreenGalleryProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Sync state when opened with a specific image
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, initialIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goToNext();
      if (event.key === "ArrowLeft") goToPrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, goToNext, goToPrev]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in font-sans">
      {/* Close Button - matching popup styles but adapted for dark background */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 z-[110] p-2.5 sm:p-1.5 rounded-full border border-background/20 bg-black/50 text-background/80 hover:bg-background/20 hover:text-background transition-colors cursor-pointer"
        aria-label={t("close")}
      >
        <X size={24} className="h-6 w-6 sm:h-5 sm:w-5" />
      </button>

      {/* Navigation Buttons */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goToPrev();
            }}
            className="absolute left-4 lg:left-8 z-[110] p-2 lg:p-3 max-md:hidden pointer-coarse:hidden rounded-full border border-background/20 bg-black/50 text-background/80 hover:bg-background/20 hover:text-background transition-colors cursor-pointer"
            aria-label={t("previous_image")}
          >
            <ChevronLeft className="size-6 lg:size-8" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goToNext();
            }}
            className="absolute right-4 lg:right-8 z-[110] p-2 lg:p-3 max-md:hidden pointer-coarse:hidden rounded-full border border-background/20 bg-black/50 text-background/80 hover:bg-background/20 hover:text-background transition-colors cursor-pointer"
            aria-label={t("next_image")}
          >
            <ChevronRight className="size-6 lg:size-8" />
          </button>
        </>
      )}

      {/* Image Container */}
      <div 
        className="w-full h-full flex items-center justify-center p-4 md:p-12 cursor-pointer"
        onClick={onClose}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            alt={`Gallery image ${currentIndex + 1}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="max-w-full max-h-full object-contain select-none shadow-2xl cursor-default rounded-2xl"
            onClick={(event) => event.stopPropagation()}
            onError={handleImageLoadError}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(event, { offset }) => {
              const swipe = offset.x;
              if (swipe < -50) goToNext();
              else if (swipe > 50) goToPrev();
            }}
          />
        </AnimatePresence>
      </div>
      
      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 border border-background/20 text-background/80 text-sm font-medium tracking-wide">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
