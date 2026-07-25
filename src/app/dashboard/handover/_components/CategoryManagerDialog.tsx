"use client";

import React from "react";
import { Plus, Trash2, Save, Pencil } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { createClient } from "@/utils/supabase/client";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import type { DocumentCategory } from "../_lib/types";

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  categories: DocumentCategory[];
  onChanged: () => void;
}

const COLOR_OPTIONS: Array<{ value: DocumentCategory["color"]; label: string; chip: string }> = [
  { value: "slate",   label: "Trung tính", chip: "status-neutral-bg" },
  { value: "blue",    label: "Xanh dương", chip: "status-info-bg" },
  { value: "amber",   label: "Vàng kim",   chip: "status-warning-bg" },
  { value: "emerald", label: "Xanh lá",    chip: "status-success-bg" },
  { value: "red",     label: "Đỏ",          chip: "status-danger-bg" },
];

export default function CategoryManagerDialog({ isOpen, setIsOpen, categories, onChanged }: Props) {
  const supabase = React.useMemo(() => createClient(), []);

  // Form thêm mới
  const [newName, setNewName] = React.useState("");
  const [newSla, setNewSla] = React.useState("24");
  const [newColor, setNewColor] = React.useState<DocumentCategory["color"]>("slate");

  // Sửa từng dòng
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<{ name: string; sla_hours: string; color: DocumentCategory["color"] }>({
    name: "",
    sla_hours: "24",
    color: "slate",
  });

  React.useEffect(() => {
    if (isOpen) {
      setNewName("");
      setNewSla("24");
      setNewColor("slate");
      setEditingId(null);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    const name = newName.trim();
    const sla = parseInt(newSla, 10);
    if (!name) {
      notifyValidation("Vui lòng nhập tên nhóm hồ sơ");
      return;
    }
    if (!Number.isFinite(sla) || sla <= 0) {
      notifyValidation("Số giờ SLA phải lớn hơn 0", "SLA không hợp lệ");
      return;
    }
    const { error } = await supabase
      .from("document_categories")
      .insert({ name, sla_hours: sla, color: newColor });
    if (error) {
      notifyError(error, "Không tạo được nhóm hồ sơ");
      return;
    }
    notifySuccess("Đã thêm nhóm hồ sơ");
    setNewName("");
    setNewSla("24");
    setNewColor("slate");
    onChanged();
  };

  const startEdit = (c: DocumentCategory) => {
    setEditingId(c.id);
    setEditDraft({ name: c.name, sla_hours: String(c.sla_hours), color: c.color });
  };

  const handleSaveEdit = async (id: string) => {
    const name = editDraft.name.trim();
    const sla = parseInt(editDraft.sla_hours, 10);
    if (!name) {
      notifyValidation("Tên nhóm không được để trống");
      return;
    }
    if (!Number.isFinite(sla) || sla <= 0) {
      notifyValidation("Số giờ SLA phải lớn hơn 0", "SLA không hợp lệ");
      return;
    }
    const { error } = await supabase
      .from("document_categories")
      .update({ name, sla_hours: sla, color: editDraft.color })
      .eq("id", id);
    if (error) {
      notifyError(error, "Không lưu được thay đổi");
      return;
    }
    notifySuccess("Đã cập nhật nhóm hồ sơ");
    setEditingId(null);
    onChanged();
  };

  const handleDelete = async (c: DocumentCategory) => {
    const ok = await confirmDialog({
      title: "Xoá nhóm hồ sơ?",
      description: `Nhóm "${c.name}" sẽ bị xoá. Hồ sơ cũ đã chọn nhóm này vẫn giữ tham chiếu cho đến khi chỉnh lại.`,
      confirmText: "Xoá",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("document_categories").delete().eq("id", c.id);
    if (error) {
      notifyError(error, "Không xoá được nhóm hồ sơ");
      return;
    }
    notifySuccess("Đã xoá nhóm hồ sơ");
    onChanged();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-lg font-semibold text-slate-900">Quản lý nhóm hồ sơ</DialogTitle>
          <DialogDescription className="text-subtitle">
            Mỗi nhóm gắn một SLA (giờ) — người dùng chỉ chọn nhóm, hệ thống tự áp dụng SLA.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="app-dialog-sheet-body">
          <div className="group-stack px-[var(--app-page-x)] py-4">
            {/* Form thêm mới */}
            <div className="item-stack p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Thêm nhóm mới</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-medium text-slate-500">Tên nhóm</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="VD: Hồ sơ kiểm toán"
                    className="h-11 bg-white border-slate-200 rounded-xl font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-500">SLA (giờ)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newSla}
                    onChange={(e) => setNewSla(e.target.value)}
                    className="h-11 bg-white border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs font-medium text-slate-500">Màu badge</Label>
                  <Select value={newColor} onValueChange={(v) => setNewColor(v as DocumentCategory["color"])}>
                    <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleCreate}
                  className="min-h-11 px-4 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" /> Thêm
                </Button>
              </div>
            </div>

            {/* Danh sách hiện có */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Hiện có {categories.length} nhóm</p>
              {categories.map((c) => {
                const isEditing = editingId === c.id;
                const colorOpt = COLOR_OPTIONS.find((o) => o.value === c.color);
                return (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white rounded-xl border border-slate-100"
                  >
                    {isEditing ? (
                      <>
                        <Input
                          value={editDraft.name}
                          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          className="h-10 bg-slate-50 border-none rounded-lg font-medium flex-1"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={editDraft.sla_hours}
                          onChange={(e) => setEditDraft({ ...editDraft, sla_hours: e.target.value })}
                          className="h-10 w-24 bg-slate-50 border-none rounded-lg font-medium"
                        />
                        <Select
                          value={editDraft.color}
                          onValueChange={(v) => setEditDraft({ ...editDraft, color: v as DocumentCategory["color"] })}
                        >
                          <SelectTrigger className="h-10 w-32 bg-slate-50 border-none rounded-lg font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLOR_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleSaveEdit(c.id)}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-lg text-slate-500 hover:bg-slate-100"
                            onClick={() => setEditingId(null)}
                          >
                            ✕
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {colorOpt && (
                            <Badge className={colorOpt.chip + " font-semibold text-xs"}>
                              {c.name}
                            </Badge>
                          )}
                          <span className="text-label">
                            SLA {c.sla_hours} giờ
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-lg text-slate-500 hover:bg-slate-100"
                            onClick={() => startEdit(c)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-lg text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(c)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              {categories.length === 0 && (
                <EmptyState
                  icon={<Plus className="icon-lg" />}
                  title="Chưa có nhóm hồ sơ"
                  description='Thêm nhóm đầu tiên ở phía trên.'
                  variant="subtle"
                />
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="min-h-11 px-4 rounded-xl font-medium text-slate-500 text-sm"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
