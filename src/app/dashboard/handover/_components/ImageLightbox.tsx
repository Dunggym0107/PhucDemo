"use client";

import React from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  images: string[];
  startIndex: number | null;
  onClose: () => void;
}

// Lightbox đơn giản dùng portal Radix-free — fullscreen, swipe trái phải,
// pinch-zoom native qua touch-action.
export default function ImageLightbox({ images, startIndex, onClose }: Props) {
  const [index, setIndex] = React.useState<number>(startIndex ?? 0);

  React.useEffect(() => {
    if (startIndex !== null) setIndex(startIndex);
  }, [startIndex]);

  // Khoá scroll body khi mở
  React.useEffect(() => {
    if (startIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [startIndex]);

  // Phím tắt: ESC đóng, mũi tên di chuyển
  React.useEffect(() => {
    if (startIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startIndex, images.length, onClose]);

  if (startIndex === null || images.length === 0) return null;

  const total = images.length;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center select-none"
      onClick={onClose}
    >
      {/* Toolbar */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 backdrop-blur text-white flex items-center justify-center active:scale-95 transition-all z-10"
        aria-label="Đóng"
      >
        <X className="w-5 h-5" />
      </button>

      {total > 1 && (
        <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur text-white text-xs font-semibold tabular-nums">
          {index + 1} / {total}
        </span>
      )}

      {/* Prev/Next */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => Math.max(0, i - 1));
            }}
            disabled={index === 0}
            className="absolute left-4 w-11 h-11 rounded-full bg-white/10 backdrop-blur text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => Math.min(total - 1, i + 1));
            }}
            disabled={index === total - 1}
            className="absolute right-4 w-11 h-11 rounded-full bg-white/10 backdrop-blur text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
            aria-label="Ảnh sau"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Ảnh */}
      <div
        className="w-full h-full flex items-center justify-center p-6"
        style={{ touchAction: "pinch-zoom" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index]}
          alt={`Ảnh ${index + 1}`}
          className="max-w-full max-h-full object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}
