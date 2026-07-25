"use client";

import React from "react";
import { Camera, Loader2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notifyError, notifyValidation } from "@/lib/notify";
import { createClient } from "@/utils/supabase/client";
import { MAX_IMAGES_PER_DOCUMENT } from "../_lib/constants";
import { compressDocumentImage } from "../_lib/compressImage";

interface Props {
  documentId: string;
  imageUrls: string[];
  onChange: (urls: string[]) => void;
  onClickImage?: (index: number) => void;
  readOnly?: boolean;
}

// Upload + thumbnail grid. Mobile: input có capture="environment" → mở camera native.
export default function ImageUploader({ documentId, imageUrls, onChange, onClickImage, readOnly }: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (imageUrls.length + files.length > MAX_IMAGES_PER_DOCUMENT) {
      notifyValidation(
        `Mỗi hồ sơ chỉ đính kèm tối đa ${MAX_IMAGES_PER_DOCUMENT} ảnh.`,
        "Vượt giới hạn ảnh"
      );
      e.target.value = "";
      return;
    }
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    const newUrls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const raw = files[i];
        if (!raw.type.startsWith("image/")) continue;
        const compressed = await compressDocumentImage(raw);
        const ts = Date.now();
        const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${documentId}/${ts}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, compressed, { upsert: false, contentType: compressed.type });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path);
        newUrls.push(publicUrl);
        setProgress({ done: i + 1, total: files.length });
      }
      onChange([...imageUrls, ...newUrls]);
    } catch (err) {
      notifyError(err, "Không upload được ảnh");
    } finally {
      setUploading(false);
      setProgress(null);
      e.target.value = "";
    }
  };

  const removeImage = async (idx: number) => {
    const url = imageUrls[idx];
    // Parse path từ public URL — format: .../storage/v1/object/public/documents/<path>
    try {
      const marker = "/storage/v1/object/public/documents/";
      const at = url.indexOf(marker);
      if (at >= 0) {
        const path = url.substring(at + marker.length);
        await supabase.storage.from("documents").remove([path]);
      }
    } catch (err) {
      // Không chặn UI nếu xoá storage fail — ảnh sẽ được cleanup bởi cron 30 ngày
      console.warn("Storage remove failed:", err);
    }
    onChange(imageUrls.filter((_, i) => i !== idx));
  };

  const canAdd = !readOnly && imageUrls.length < MAX_IMAGES_PER_DOCUMENT;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {imageUrls.map((url, idx) => (
          <div
            key={url}
            className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Ảnh ${idx + 1}`}
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => onClickImage?.(idx)}
            />
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-slate-900/60 backdrop-blur text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Xoá ảnh"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-500 transition-all",
              "hover:border-primary/30 hover:bg-primary/5 hover:text-primary active:scale-[0.97]"
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {progress && (
                  <span className="text-xs font-semibold">
                    {progress.done}/{progress.total}
                  </span>
                )}
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span className="text-xs font-semibold">Thêm ảnh</span>
              </>
            )}
          </button>
        )}
      </div>

      {imageUrls.length === 0 && !canAdd && (
        <p className="text-meta italic">Chưa có ảnh đính kèm</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
    </div>
  );
}
