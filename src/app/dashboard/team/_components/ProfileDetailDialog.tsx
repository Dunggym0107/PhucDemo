'use client'

import React, { useMemo, useState } from "react";
import { Phone, Mail, Award, Pencil, Briefcase, Calendar, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { viLocale as vi } from "@/lib/locale";
import {
  canViewSensitiveProfileFields, canEditProfile, canRecognize,
} from "@/lib/permissions";
import { ProfileStatus, ROLE_LABELS, STATUS_BADGES } from "../_lib/constants";
import { getProfileBadgeStatus, getYearsOfService } from "../_lib/utils";
import { useProfileDetail } from "../_hooks/useProfileDetail";
import { useRecognitions } from "../_hooks/useRecognitions";
import ProfileSensitiveSection from "./ProfileSensitiveSection";
import ProfileStatsSection from "./ProfileStatsSection";
import RecognitionsSection from "./RecognitionsSection";
import OutOfOfficeToggle from "./OutOfOfficeToggle";
import EditProfileDialog from "./EditProfileDialog";

// Dialog chi tiết hồ sơ nhân sự — thay thế route /team/[id].
// Mở qua deep link ?id=<uuid>. Đóng → xoá ?id= khỏi URL.
// Hero header nền nhẹ theo trạng thái, icon không dùng background chip.
// Footer sticky: Gọi (tel:) — Mail (mailto:) — Ghi nhận (scroll to section).
interface ProfileDetailDialogProps {
  targetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: any;
  todaySchedules: any[];
}

export default function ProfileDetailDialog({
  targetId, open, onOpenChange, viewer, todaySchedules,
}: ProfileDetailDialogProps) {
  const { target, monthlyTasks, recognitions, ooo, loading, refetch } = useProfileDetail(open ? targetId : null);
  const [localRecogs, setLocalRecogs] = useState<any[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  React.useEffect(() => { setLocalRecogs(recognitions); }, [recognitions]);

  const { send, remove, sending } = useRecognitions({
    senderId: viewer?.id ?? null,
    receiverId: target?.id ?? null,
    onOptimisticAdd: (r) => setLocalRecogs((cur) => [r, ...(cur ?? [])]),
    onOptimisticRemove: (id) => setLocalRecogs((cur) => (cur ?? []).filter((r) => r.id !== id)),
    onError: () => refetch(),
  });

  const status: ProfileStatus = useMemo(() => {
    if (!target) return 'available';
    return getProfileBadgeStatus(target, todaySchedules, ooo, viewer, new Date());
  }, [target, todaySchedules, ooo, viewer]);

  const isSelf = viewer && target && viewer.id === target.id;
  const canSeeSensitive = canViewSensitiveProfileFields(viewer, target);
  const canEdit = canEditProfile(viewer, target);
  const canSendRecog = canRecognize(viewer) && !isSelf;

  const statusMeta = STATUS_BADGES[status];
  const years = target ? getYearsOfService(target.branch_join_date) : null;
  const deptName = target?.departments?.name ?? (Array.isArray(target?.departments) ? target?.departments[0]?.name : null);
  // Email: dữ liệu legacy lưu username (không có @), dữ liệu mới user tự nhập đầy đủ.
  // Hiển thị + mailto đều phải xử lý cả 2 dạng.
  const emailAddress = target?.ad_account
    ? (target.ad_account.includes('@') ? target.ad_account : `${target.ad_account}@vietinbank.vn`)
    : null;
  const mailto = emailAddress ? `mailto:${emailAddress}` : null;

  const scrollToRecog = () => {
    document.getElementById('recognitions-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Tone hero theo trạng thái — nền rất nhẹ, không quá nổi.
  const heroBg = (() => {
    if (status === 'on_leave') return 'bg-amber-50/50';
    if (status === 'on_trip') return 'bg-sky-50/50';
    if (status === 'new_joiner') return 'bg-emerald-50/50';
    return 'bg-slate-50/60';
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="app-dialog-sheet app-dialog-sheet--xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Hồ sơ {target?.full_name ?? 'cán bộ'}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="app-dialog-sheet-body">
            {loading && !target && (
              <p className="text-meta text-center py-12">Đang tải hồ sơ…</p>
            )}

            {target && (
              <>
                {/* HERO — nền nhẹ, không decorative noise. Edit nằm góc phải. */}
                <header className={cn("border-b border-slate-100 px-[var(--app-page-x)] py-5 sm:py-6", heroBg)}>
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="relative shrink-0">
                      <Avatar className="h-16 w-16 ring-2 ring-white shadow-sm">
                        <AvatarImage src={target.avatar_url} className="object-cover" />
                        <AvatarFallback className="bg-primary text-white text-xl font-bold">{target.full_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white", statusMeta.dotColor)} />
                    </div>
                    <div className="flex-1 min-w-0 item-stack !gap-1">
                      <h2 className="heading-section break-words">{target.full_name}</h2>
                      {target.title && <p className="text-label truncate">{target.title}</p>}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {status !== 'available' && (
                          <Badge className={cn("font-bold rounded-md border", statusMeta.chipClass)}>{statusMeta.label}</Badge>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white shrink-0 mr-9"
                        onClick={() => setEditOpen(true)}
                        aria-label="Sửa hồ sơ"
                      >
                        <Pencil className="icon-sm" />
                      </Button>
                    )}
                  </div>
                </header>

                <div className="px-[var(--app-page-x)] py-5 group-stack">
                  {/* OOO BANNER */}
                  {ooo && new Date(ooo.ends_at) > new Date() && (
                    <section className="rounded-2xl status-warning-bg border border-amber-200 p-4 item-stack">
                      <p className="heading-card text-amber-900">📍 Đang vắng mặt</p>
                      <p className="text-label !text-amber-900 leading-snug">{ooo.message}</p>
                      <p className="text-meta !text-amber-700">
                        Đến {format(new Date(ooo.ends_at), "EEEE, dd/MM/yyyy HH:mm", { locale: vi })}
                      </p>
                    </section>
                  )}

                  {/* CONTACT */}
                  <section className="premium-card p-4 item-stack">
                    <h4 className="heading-card">Thông tin liên hệ</h4>
                    <div className="flex flex-col">
                      <ContactRow
                        icon={Briefcase}
                        label="Phòng ban"
                        value={deptName ?? '—'}
                      />
                      <ContactRow
                        icon={Phone}
                        label="Số di động"
                        value={target.phone ?? '—'}
                        href={target.phone ? `tel:${target.phone}` : undefined}
                        accent={!!target.phone}
                      />
                      <ContactRow
                        icon={Mail}
                        label="Email"
                        value={emailAddress ?? '—'}
                        href={mailto ?? undefined}
                        accent={!!mailto}
                        valueClassName="truncate"
                      />
                      <ContactRow
                        icon={Calendar}
                        label="Vào chi nhánh"
                        value={target.branch_join_date
                          ? `${format(new Date(target.branch_join_date), "dd/MM/yyyy", { locale: vi })}${years !== null ? ` · ${years} năm` : ''}`
                          : '—'}
                        last
                      />
                    </div>
                  </section>

                  {/* STATS */}
                  <ProfileStatsSection monthlyTasks={monthlyTasks} />

                  {/* SENSITIVE — gated */}
                  {canSeeSensitive && <ProfileSensitiveSection target={target} />}

                  {/* OOO TOGGLE — chỉ self */}
                  {isSelf && (
                    <OutOfOfficeToggle userId={target.id} currentOoo={ooo} onChange={refetch} />
                  )}

                  {/* RECOGNITIONS */}
                  <div id="recognitions-section">
                    <RecognitionsSection
                      recognitions={localRecogs ?? recognitions}
                      viewerId={viewer?.id ?? null}
                      receiverName={target.full_name ?? 'đồng nghiệp'}
                      canSend={canSendRecog}
                      sending={sending}
                      onSend={send}
                      onDelete={remove}
                    />
                  </div>
                </div>
              </>
            )}
          </ScrollArea>

          {target && (
            <DialogFooter className="app-dialog-sheet-footer flex-row gap-2">
              <Button
                asChild={!!target.phone}
                variant="outline"
                disabled={!target.phone}
                className="flex-1 min-h-11 rounded-xl border-slate-200 font-semibold"
              >
                {target.phone ? (
                  <a href={`tel:${target.phone}`}><Phone className="icon-sm mr-1.5" /> Gọi</a>
                ) : (
                  <span><Phone className="icon-sm mr-1.5" /> Gọi</span>
                )}
              </Button>
              <Button
                asChild={!!mailto}
                variant="outline"
                disabled={!mailto}
                className="flex-1 min-h-11 rounded-xl border-slate-200 font-semibold"
              >
                {mailto ? (
                  <a href={mailto}><Mail className="icon-sm mr-1.5" /> Mail</a>
                ) : (
                  <span><Mail className="icon-sm mr-1.5" /> Mail</span>
                )}
              </Button>
              {canSendRecog && (
                <Button
                  className="flex-1 min-h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold"
                  onClick={scrollToRecog}
                >
                  <Award className="icon-sm mr-1.5" /> Ghi nhận
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {target && canEdit && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          target={target}
          viewer={viewer}
          onSaved={refetch}
        />
      )}
    </>
  );
}

function ContactRow({
  icon: Icon, label, value, href, accent, last, valueClassName,
}: {
  icon: any; label: string; value: string; href?: string;
  accent?: boolean; last?: boolean; valueClassName?: string;
}) {
  const inner = (
    <div className={cn(
      "flex items-center gap-3 min-h-11 py-2.5",
      !last && "border-b border-slate-100",
    )}>
      <Icon className={cn("icon-sm shrink-0", accent ? "text-primary" : "text-slate-500")} />
      <div className="flex-1 min-w-0 item-stack !gap-0.5">
        <span className="text-meta">{label}</span>
        <span className={cn("text-label !text-slate-900 font-semibold", valueClassName)}>{value}</span>
      </div>
      {href && <ChevronRight className="icon-sm text-slate-300 shrink-0" />}
    </div>
  );
  if (href) {
    return (
      <a
        href={href}
        className="block transition-colors hover:bg-slate-50/60 active:bg-slate-100/60"
      >
        {inner}
      </a>
    );
  }
  return inner;
}
