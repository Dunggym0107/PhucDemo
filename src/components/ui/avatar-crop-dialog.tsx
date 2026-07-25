'use client'

import React, { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import imageCompression from "browser-image-compression";
import { Crop, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

// Dialog cắt ảnh đại diện — pan + zoom, output blob hình tròn vuông 1:1.
// Dùng cho mọi avatar upload trong app để tránh ảnh bị méo / lệch khung mặt.
interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: File | null;
  onCropped: (blob: Blob) => void;
}

// Tạo Image từ src.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Cắt ảnh + nén — output blob JPEG ≤100KB ở 384×384 (đủ sắc nét cho retina).
async function getCroppedBlob(imageSrc: string, area: Area, size = 384): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);

  const initial = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Cannot create blob')),
      'image/jpeg',
      0.82,
    );
  });
  if (initial.size <= 100 * 1024) return initial;

  // Belt-and-suspenders: nén thêm cho ảnh có nội dung phức tạp (ảnh chụp ngoài trời).
  const file = new File([initial], 'avatar.jpg', { type: 'image/jpeg' });
  try {
    return await imageCompression(file, {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 384,
      useWebWorker: true,
      initialQuality: 0.8,
    });
  } catch {
    return initial;
  }
}

export default function AvatarCropDialog({ open, onOpenChange, file, onCropped }: AvatarCropDialogProps) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // Đọc file → dataURL khi file thay đổi
  React.useEffect(() => {
    if (!file) { setImageSrc(null); return; }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, [file]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setAreaPx(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !areaPx) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, areaPx, 384);
      onCropped(blob);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--lg">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section flex items-center gap-2">
            <Crop className="icon-sm text-primary" />
            Cắt ảnh đại diện
          </DialogTitle>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">
            {/* Cropper area — fixed aspect 1:1 */}
            <div className="relative w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden">
              {imageSrc ? (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-meta !text-white/70">
                  Đang tải ảnh…
                </div>
              )}
            </div>

            {/* Zoom slider */}
            <div className="item-stack !gap-2">
              <div className="flex items-center justify-between">
                <span className="text-label">Phóng to / thu nhỏ</span>
                <span className="text-meta tabular-nums">{zoom.toFixed(1)}×</span>
              </div>
              <div className="flex items-center gap-3">
                <ZoomOut className="icon-sm text-slate-500 shrink-0" />
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.05}
                  onValueChange={(v) => setZoom(v[0])}
                  className="flex-1"
                />
                <ZoomIn className="icon-sm text-slate-500 shrink-0" />
              </div>
            </div>

            <p className="text-meta">Kéo để di chuyển khung • Trượt để phóng to giúp căn khung mặt</p>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 min-h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            Huỷ
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={processing || !areaPx}
            className="flex-1 min-h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold"
          >
            <Crop className="icon-sm mr-1.5" />
            {processing ? "Đang xử lý…" : "Cắt ảnh"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
