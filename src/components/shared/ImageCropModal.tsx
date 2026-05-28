"use client";

import { useState, useRef, MouseEvent, TouchEvent } from "react";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";
import { Media } from "@/types";

interface ImageCropModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (position: { x: number; y: number; zoom: number }) => void;
  initialPosition?: { x: number; y: number; zoom: number };
  media?: Media;
}

export default function ImageCropModal({
  imageUrl,
  onClose,
  onSave,
  initialPosition,
  media,
}: ImageCropModalProps) {
  const [zoom, setZoom] = useState(initialPosition?.zoom || 1);
  const [position, setPosition] = useState({ x: initialPosition?.x || 0, y: initialPosition?.y || 0 });
  const orientation = media?.orientation;
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const constrainPosition = (x: number, y: number, currentZoom: number) => {
    const imgWidth = media?.width || 300;
    const imgHeight = media?.height || 300;
    const isPortrait = orientation === "Portrait";
    
    const baseWidth = isPortrait ? 300 : 300 * (imgWidth / imgHeight);
    const baseHeight = !isPortrait ? 300 : 300 * (imgHeight / imgWidth);
    
    const scaledWidth = baseWidth * currentZoom;
    const scaledHeight = baseHeight * currentZoom;
    
    const maxX = Math.max(0, (scaledWidth - 300) / 2);
    const maxY = Math.max(0, (scaledHeight - 300) / 2);
    
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const rawX = e.clientX - dragStart.current.x;
    const rawY = e.clientY - dragStart.current.y;
    setPosition(constrainPosition(rawX, rawY, zoom));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Support
  const handleTouchStart = (e: TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const rawX = touch.clientX - dragStart.current.x;
    const rawY = touch.clientY - dragStart.current.y;
    setPosition(constrainPosition(rawX, rawY, zoom));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans animate-fade-in">
      <div className="bg-white rounded-3xl border border-border/45 w-full max-w-[420px] p-6 space-y-6 shadow-xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-heading text-lg font-semibold text-foreground">Position Cover Image</h3>
            <p className="text-xs text-muted-foreground">Drag to position, use slider to zoom.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full border border-border hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Crop Area */}
        <div className="flex justify-center">
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative w-[300px] h-[300px] bg-muted border border-border rounded-2xl overflow-hidden cursor-move select-none"
          >
            <img
              src={imageUrl}
              alt="Crop workspace"
              className="absolute pointer-events-none transition-transform duration-75"
              style={{
                left: "50%",
                top: "50%",
                width: orientation === "Portrait" ? "100%" : "auto",
                height: orientation === "Landscape" ? "100%" : "auto",
                minWidth: "100%",
                minHeight: "100%",
                transformOrigin: "center center",
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              }}
            />
            {/* Guide Grid Overlays */}
            <div className="absolute inset-0 border border-white/20 pointer-events-none grid grid-cols-3 grid-rows-3">
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-r border-b border-white/10" />
              <div className="border-b border-white/10" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <ZoomOut size={16} className="text-muted-foreground" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => {
                const newZoom = parseFloat(e.target.value);
                setZoom(newZoom);
                setPosition((prev) => constrainPosition(prev.x, prev.y, newZoom));
              }}
              className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <ZoomIn size={16} className="text-muted-foreground" />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
            <span>Zoom: {Math.round(zoom * 100)}%</span>
            <span>X: {Math.round(position.x)}px, Y: {Math.round(position.y)}px</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted/30 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ x: position.x, y: position.y, zoom })}
            className="flex items-center gap-1 px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-95 transition-opacity"
          >
            <Check size={16} />
            Apply Crop
          </button>
        </div>

      </div>
    </div>
  );
}
