"use client";

import React from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Undo2,
  User,
  Building2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { notifyError, notifySuccess } from "@/lib/notify";
import { DOCUMENT_STATUS_META } from "../_lib/constants";
import { fetchDocumentById } from "../_lib/fetchHandover";
import { acknowledgeDocument, completeDocument, adminCompleteDocument } from "../_lib/transferActions";
import { canViewAllDocuments } from "@/lib/permissions";
import type { DocumentRow, HandoverRow } from "../_lib/types";
import HandoverTimeline from "./HandoverTimeline";
import SLABadge from "./SLABadge";
import TransferDialog from "./TransferDialog";
import ReturnReasonDialog from "./ReturnReasonDialog";
import ImageUploader from "./ImageUploader";
import ImageLightbox from "./ImageLightbox";

interface Props {
  documentId: string | null;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  profile: any;
  allProfiles: any[];
  onChanged: () => void;
}

export default function DocumentDetailDialog({
  documentId,
  isOpen,
  setIsOpen,
  profile,
  allProfiles,
  onChanged,
}: Props) {
  const [doc, setDoc] = React.useState<DocumentRow | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [isTransferOpen, setIsTransferOpen] = React.useState(false);
  const [isReturnOpen, setIsReturnOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  const refetch = React.useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    const fresh = await fetchDocumentById(documentId);
    setDoc(fresh);
    setLoading(false);
  }, [documentId]);

  React.useEffect(() => {
    if (!isOpen || !documentId) {
      setDoc(null);
      return;
    }
    refetch();
  }, [isOpen, documentId, refetch]);

  if (!isOpen || !documentId) return null;

  const meta = doc && DOCUMENT_STATUS_META[doc.status];
  const StatusIcon = meta?.icon;

  const isCreator = doc?.creator_id === profile?.id;
  const isHolder = doc?.current_assignee_id === profile?.id;
  const isReadOnly = !isHolder && !isCreator && !canViewAllDocuments(profile);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'director';

  // Tìm handover PENDING gần nhất với receiver = me → để show "Đã nhận" / "Trả về"
  const pendingHandover: HandoverRow | undefined = doc?.handovers?.find(
    (h) => h.status === "PENDING" && h.receiver_id === profile?.id
  );

  // Hồ sơ đang chờ người khác nhận — ẩn nút action của sender, hiển thị info đang chờ ai
  const outgoingPending: HandoverRow | undefined = doc?.handovers?.find(
    (h) => h.status === "PENDING" && h.sender_id === profile?.id
  );

  // Sender chỉ được thao tác (Chuyển/Hoàn thành) khi đang giữ hồ sơ thực sự,
  // tức không trong trạng thái chờ người khác nhận.
  const canSenderAct = !!doc
    && isHolder
    && !outgoingPending
    && doc.status !== "PENDING_RECEIPT"
    && doc.status !== "COMPLETED";
  const canAdminForceComplete = isAdmin && doc && doc.status !== 'COMPLETED' && !canSenderAct;

  const handleAcknowledge = async () => {
    if (!pendingHandover) return;
    const res = await acknowledgeDocument(pendingHandover.id);
    if (!res.ok) {
      notifyError(res.error, "Không xác nhận được hồ sơ");
      return;
    }
    notifySuccess("Đã nhận hồ sơ", "Hệ thống bắt đầu đếm SLA từ giây phút này.");
    await refetch();
    onChanged();
  };

  const handleComplete = async () => {
    if (!doc) return;
    const res = await completeDocument(doc.id);
    if (!res.ok) {
      notifyError(res.error, "Không hoàn thành được hồ sơ");
      return;
    }
    notifySuccess("Đã hoàn thành", "Luồng luân chuyển hồ sơ đã đóng.");
    await refetch();
    onChanged();
  };

  const handleImagesChange = async (newUrls: string[]) => {
    if (!doc) return;
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const { error } = await supabase
      .from("documents")
      .update({ attached_image_urls: newUrls })
      .eq("id", doc.id);
    if (error) {
      notifyError(error, "Không lưu được ảnh đính kèm");
      return;
    }
    await refetch();
    onChanged();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent hideCloseButton className="app-dialog-sheet app-dialog-sheet--xl shadow-2xl flex flex-col p-0">
          <DialogHeader className="app-dialog-sheet-header">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                {doc?.short_code || "—"}
              </p>
              {meta && StatusIcon && (
                <Badge className={cn("font-semibold text-xs", meta.badgeClass)}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {meta.label}
                </Badge>
              )}
              {doc && <SLABadge document={doc} />}
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900 leading-tight">
              {doc?.title || "Đang tải..."}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Chi tiết hồ sơ, timeline luân chuyển và các thao tác chuyển/nhận.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="app-dialog-sheet-body">
            <div className="group-stack px-[var(--app-page-x)] py-4">
              {loading && !doc && (
                <p className="text-sm text-slate-500 font-medium">Đang tải dữ liệu...</p>
              )}

              {doc && (
                <>
                  {/* Thông tin cơ bản */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {doc.customer_name && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-meta">Khách hàng</p>
                          <p className="text-sm font-semibold text-slate-700 truncate">
                            {doc.customer_name}
                          </p>
                        </div>
                      </div>
                    )}
                    {doc.category && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <FileText className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-meta">Nhóm hồ sơ</p>
                          <p className="text-sm font-semibold text-slate-700 truncate">
                            {doc.category.name} · SLA {doc.category.sla_hours}h
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Vị trí hiện tại của hồ sơ — khi PENDING_RECEIPT thì hiển thị người
                        đang chờ nhận thay vì current_assignee_id (vẫn là sender chưa chuyển ownership) */}
                    {(() => {
                      const pendingFromCurrent = doc.handovers?.find(
                        (h) => h.status === "PENDING" && h.sender_id === doc.current_assignee_id
                      );
                      const displayAssignee = doc.status === "PENDING_RECEIPT" && pendingFromCurrent?.receiver
                        ? pendingFromCurrent.receiver
                        : doc.current_assignee;
                      const positionLabel = doc.status === "PENDING_RECEIPT"
                        ? "Đang chờ nhận"
                        : "Đang ở bàn";
                      if (!displayAssignee) return null;
                      return (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl sm:col-span-2">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <Building2 className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-meta">{positionLabel}</p>
                            <p className="text-sm font-semibold text-slate-700 truncate">
                              {displayAssignee.full_name}
                              <span className="text-slate-500 font-medium">
                                {" "}· {displayAssignee.departments?.name || "—"}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Ảnh đính kèm */}
                  {(doc.attached_image_urls.length > 0 || isHolder || isCreator) && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500">
                        Ảnh bìa / tờ trình ({doc.attached_image_urls.length})
                      </p>
                      <ImageUploader
                        documentId={doc.id}
                        imageUrls={doc.attached_image_urls}
                        onChange={handleImagesChange}
                        onClickImage={(idx) => setLightboxIndex(idx)}
                        readOnly={isReadOnly || doc.status === "COMPLETED" || !!outgoingPending}
                      />
                    </div>
                  )}


                  {/* Timeline */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500">Truy vết luân chuyển</p>
                    <HandoverTimeline document={doc} />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <div className="app-dialog-sheet-footer flex flex-row justify-between items-center gap-3 border-t border-slate-100 p-4">
            <div className="flex items-center gap-1.5">
              {/* Người nhận đang chờ → "Đã nhận" / "Trả về" */}
              {pendingHandover && doc && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setIsReturnOpen(true)}
                    title="Trả về"
                    className="h-10 px-3 rounded-xl font-medium text-sm text-red-600 bg-red-50 hover:bg-red-100"
                  >
                    <Undo2 className="w-4 h-4 mr-1.5" /> Trả về
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleAcknowledge}
                    title="Đã nhận"
                    className="h-10 px-3 rounded-xl font-medium text-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  >
                    <Check className="w-4 h-4 mr-1.5" /> Đã nhận
                  </Button>
                </>
              )}

              {/* Người đang giữ (đã accept) → "Chuyển tiếp" / "Hoàn thành" */}
              {canSenderAct && doc && (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleComplete}
                    title="Hoàn thành"
                    className="h-10 px-3 rounded-xl font-medium text-sm text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Hoàn thành
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setIsTransferOpen(true)}
                    title="Chuyển tiếp"
                    className="h-10 px-3 rounded-xl font-medium text-sm bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    <ArrowRight className="w-4 h-4 mr-1.5" /> Chuyển tiếp
                  <ArrowRight className="w-4 h-4 mr-1.5" /> Chuyển tiếp
                  </Button>
                  </>)}
                  {/* Admin override: đóng hồ sơ */}
                  {canAdminForceComplete && (
                  <Button
                  variant="ghost"
                  onClick={async () => {
                  const { confirmDialog } = await import("@/components/ui/confirm-dialog");
                  const ok = await confirmDialog({
                    title: "Đóng hồ sơ (Hỗ trợ)?",
                    description: "Hồ sơ sẽ được đóng. Hành động này được ghi nhận là admin/BGĐ can thiệp.",
                    confirmText: "Xác nhận đóng",
                    danger: true,
                  });
                  if (!ok) return;
                  const res = await adminCompleteDocument(doc.id);
                  if (!res.ok) {
                    notifyError(res.error, "Không đóng được hồ sơ");
                    return;
                  }
                  notifySuccess("Đã đóng hồ sơ", "Admin/BGĐ can thiệp thành công.");
                  await refetch();
                  onChanged();
                  }}
                  title="Đóng hồ sơ"
                  className="h-10 px-3 rounded-xl font-medium text-sm text-orange-600 bg-orange-50 hover:bg-orange-100"
                  >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Đóng hồ sơ (Hỗ trợ)
                  </Button>
                  )}
                  </div>
            
                  <Button
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
              className="min-h-11 px-4 rounded-xl font-medium text-slate-600 text-sm bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all whitespace-nowrap"
            >
              Đóng cửa sổ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {doc && (
        <>
          <TransferDialog
            isOpen={isTransferOpen}
            setIsOpen={setIsTransferOpen}
            document={doc}
            allProfiles={allProfiles}
            currentProfile={profile}
            onSuccess={async () => {
              await refetch();
              onChanged();
            }}
          />
          {pendingHandover && (
            <ReturnReasonDialog
              isOpen={isReturnOpen}
              setIsOpen={setIsReturnOpen}
              handoverId={pendingHandover.id}
              documentShortCode={doc.short_code}
              onSuccess={async () => {
                await refetch();
                onChanged();
              }}
            />
          )}
          <ImageLightbox
            images={doc.attached_image_urls}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        </>
      )}
    </>
  );
}
