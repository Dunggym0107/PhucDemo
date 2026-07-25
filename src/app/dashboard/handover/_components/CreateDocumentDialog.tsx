"use client";

import React from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { createClient } from "@/utils/supabase/client";
import type { DocumentCategory } from "../_lib/types";
import ImageUploader from "./ImageUploader";

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  categories: DocumentCategory[];
  profile: any;
  onCreated: () => void;
}

export default function CreateDocumentDialog({ isOpen, setIsOpen, categories, profile, onCreated }: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [title, setTitle] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [imageUrls, setImageUrls] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  // ID tạm để ImageUploader nhóm file trong storage trước khi document tồn tại
  const [tempDocId] = React.useState(() => crypto.randomUUID());

  // Reset form mỗi lần mở
  React.useEffect(() => {
    if (isOpen) {
      setTitle("");
      setCustomerName("");
      setCategoryId(categories[0]?.id || "");
      setImageUrls([]);
    }
  }, [isOpen, categories]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      notifyValidation("Vui lòng nhập tiêu đề hồ sơ");
      return;
    }
    if (!categoryId) {
      notifyValidation("Vui lòng chọn nhóm hồ sơ");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .insert({
          id: tempDocId,
          title: title.trim(),
          customer_name: customerName.trim() || null,
          category_id: categoryId,
          creator_id: profile.id,
          current_assignee_id: profile.id,
          status: "DRAFT",
          attached_image_urls: imageUrls,
        })
        .select("short_code")
        .single();
      if (error) throw error;
      notifySuccess(
        "Đã tạo hồ sơ mới",
        `Mã ${data?.short_code} — hãy ghi tay mã này lên bìa hồ sơ.`
      );
      onCreated();
      setIsOpen(false);
    } catch (err) {
      notifyError(err, "Không tạo được hồ sơ");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-lg font-semibold text-slate-900">Tạo hồ sơ mới</DialogTitle>
          <DialogDescription className="text-subtitle">
            Hệ thống sẽ sinh mã ngắn để bạn ghi tay lên bìa hồ sơ bản cứng.
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="space-y-5 px-[var(--app-page-x)] py-4">
            {/* Tiêu đề */}
            <div className="space-y-2">
              <Label className="text-label">Tiêu đề hồ sơ</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Trình ký hồ sơ vay khách hàng Nguyễn Văn A"
                className="h-11 bg-slate-50 border-none rounded-xl font-medium"
              />
            </div>

            {/* Khách hàng */}
            <div className="space-y-2">
              <Label className="text-label">Khách hàng / Đối tác (tuỳ chọn)</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tên khách hàng hoặc bộ phận đối ứng"
                className="h-11 bg-slate-50 border-none rounded-xl font-medium"
              />
            </div>

            {/* Nhóm hồ sơ */}
            <div className="space-y-2">
              <Label className="text-label">Nhóm hồ sơ</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-medium">
                  <SelectValue placeholder="Chọn nhóm hồ sơ..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-lg">
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} <span className="text-slate-500">· SLA {c.sla_hours}h</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory && (
                <p className="text-label pl-1">
                  Thời gian giữ hồ sơ tối đa mỗi bàn: <span className="font-bold text-slate-700">{selectedCategory.sla_hours} giờ</span>
                </p>
              )}
            </div>

            {/* Ảnh đính kèm */}
            <div className="space-y-2">
              <Label className="text-label">Ảnh bìa / tờ trình (tuỳ chọn)</Label>
              <ImageUploader
                documentId={tempDocId}
                imageUrls={imageUrls}
                onChange={setImageUrls}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button
            variant="ghost"
            className="min-h-11 px-4 rounded-xl font-medium text-slate-500 text-sm"
            onClick={() => setIsOpen(false)}
          >
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="min-h-11 px-5 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white"
          >
            <Plus className="w-4 h-4 mr-1" /> {submitting ? "Đang tạo..." : "Tạo & lấy mã"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
