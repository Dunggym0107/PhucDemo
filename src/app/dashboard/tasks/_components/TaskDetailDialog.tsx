'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, Pencil, Trash2,
  CheckCircle2, Loader2, Play, Send, Undo2, Clock, RotateCcw,
  ChevronDown, ChevronRight, Flag, X, FileText, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  STATUS_LABEL, STATUS_BADGE_CLASS,
  PRIORITY_LABEL, PRIORITY_BADGE_CLASS,
} from '../_lib/constants';
import { batchProgress } from '../_lib/batchHelpers';
import { deleteTask, updateTaskStatus, remindTask } from '../_lib/taskActions';
import {
  canEditTask, canDeleteTask, canForceCompleteTask,
  canApproveTaskResult, canDelegateTask, canRejectSubmission, canReopenDone,
  canComposeTaskComment,
} from '@/lib/permissions';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { notifyError, notifySuccess } from '@/lib/notify';
import { TaskDueProgress } from './TaskDueProgress';
import { useTaskDetail } from '../_hooks/useTaskDetail';
import { TaskEditDialog } from './TaskEditDialog';
import { TaskDelegateDialog } from './TaskDelegateDialog';
import { TaskApproveExtensionDialog } from './TaskApproveExtensionDialog';
import { TaskRequestExtensionDialog } from './TaskRequestExtensionDialog';
import { TaskSubmitResultDialog } from './TaskSubmitResultDialog';
import { TaskReturnDialog } from './TaskReturnDialog';
import { TaskReopenDialog } from './TaskReopenDialog';
import { TaskApproveDialog } from './TaskApproveDialog';
import { TaskCommentList } from './TaskCommentList';
import { TaskTimeline } from './TaskTimeline';
import type { TaskListItem, TaskStatus } from '../_lib/types';

interface Props {
  isOpen: boolean; setIsOpen: (v: boolean) => void;
  taskId?: string | null; batchId?: string | null; children?: TaskListItem[];
  currentProfile: { id: string; role: string; department_id: string | null } | null;
  onChanged?: () => void; onOpenTask?: (taskId: string) => void;
}

const STATUS_ORDER: Record<string, number> = { todo: 0, doing: 1, submitted: 2, done: 3, canceled: 4 };

// ─── Sub-components (Schedule-style) ───
function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
    </div>
  );
}

function ActionBtn({ label, icon, onClick, disabled, amber }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; amber?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      'inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
      amber ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-primary text-white hover:bg-primary/90',
    )}>{icon}{label}</button>
  );
}

function SecondaryBtn({ label, icon, onClick, disabled }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      'inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100',
    )}>{icon}{label}</button>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT — Unified layout for single & batch
// ═══════════════════════════════════════════════════
export function TaskDetailDialog(props: Props) {
  const { isOpen, setIsOpen, taskId, batchId, children = [], currentProfile, onChanged } = props;
  const isBatch = batchId != null && children.length > 0;
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelegate, setOpenDelegate] = useState(false);
  const [openExt, setOpenExt] = useState(false);
  const [openSub, setOpenSub] = useState(false);
  const [openRet, setOpenRet] = useState(false);
  const [openReo, setOpenReo] = useState(false);
  const [openApp, setOpenApp] = useState(false);
  const [openAppExt, setOpenAppExt] = useState<any>(null);
  const [assigneesExpanded, setAssigneesExpanded] = useState(false);

  // ── Data source: batch uses rep (first child) as the "main task" ──
  const rep = isBatch ? children[0] : null;
  const activeId = isBatch ? rep?.id : taskId;
  const { loading, task, refetch } = useTaskDetail(isOpen ? (activeId ?? null) : null);
  useEffect(() => { if (task && onChanged) onChanged(); }, [task?.status, task?.updated_at]);

  // Batch children sorted by urgency
  const sorted = useMemo(() => {
    if (!isBatch) return [];
    return [...children].sort((a, b) => {
      if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
      const sa = STATUS_ORDER[a.status] ?? 99, sb = STATUS_ORDER[b.status] ?? 99;
      return sa - sb || (a.department?.name ?? '').localeCompare(b.department?.name ?? '');
    });
  }, [isBatch, children]);

  const bp = useMemo(() => isBatch ? batchProgress(children) : null, [isBatch, children]);
  const pendC = useMemo(() => children.filter(c => c.status !== 'done' && c.status !== 'canceled'), [children]);

  // ── Permissions (computed from the loaded task detail) ──
  const isAss = task && (task.assignees ?? []).some((a: any) => a.id === currentProfile?.id);
  const isSelfApprove = task?.requires_approval && task.assignees?.some((a: any) => a.id === task.created_by);
  const dueOver = !!(task?.due_date && new Date(task.due_date) < new Date() && !['done', 'canceled'].includes(task?.status ?? ''));
  const ro = task && (task.is_archived || task.status === 'canceled' || task.status === 'done');
  const canS = isAss && task?.status === 'todo';
  const canD = isAss && task?.status === 'doing' && (!task.requires_approval || isSelfApprove);
  const canSub = isAss && task?.status === 'doing' && task.requires_approval && !isSelfApprove;
  const canAp = task && canApproveTaskResult(currentProfile, task) && task?.status === 'submitted';
  const canRj = task && canRejectSubmission(currentProfile, task);
  const canRp = task && canReopenDone(currentProfile, task);
  const canRq = isAss && task?.status !== 'done' && task?.status !== 'canceled';
  const canDl = task && canDelegateTask(currentProfile, task) && task?.status !== 'done' && task?.status !== 'canceled';
  const canFC = task && canForceCompleteTask(currentProfile, task);
  const canEd = task && canEditTask(currentProfile, task);
  const canDe = task && canDeleteTask(currentProfile, task);

  // For batch: check permissions from rep (first child)
  const bCanFC = rep && canForceCompleteTask(currentProfile, rep as any);
  const canRemind = isBatch ? bCanFC : canFC;

  // ── Handlers (unified: auto-detect single vs batch) ──
  const handleStatusChange = async (n: TaskStatus, k: string, e: string) => {
    if (!task) return; setBusy(k); const r = await updateTaskStatus(task.id, n); setBusy(null);
    if (!r.ok) { notifyError(r.error, e); return; } notifySuccess('Đã cập nhật'); onChanged?.();
  };

  const handleForceComplete = async () => {
    if (isBatch) {
      // Batch: complete all pending children
      if (pendC.length === 0) return;
      if (!await confirmDialog({ title: 'Ghi nhận hoàn thành?', confirmText: 'Xác nhận', description: `Đóng ${pendC.length} việc chưa nộp.` })) return;
      setDeleting(true); let ok = 0, fe: string | undefined;
      for (const c of pendC) { const r = await updateTaskStatus(c.id, 'done', '[sys] Đã hoàn thành.'); if (r.ok) ok++; else if (!fe) fe = r.error; }
      setDeleting(false);
      if (ok === 0) { notifyError(fe ?? 'Lỗi', 'Lỗi'); return; }
      notifySuccess(`Đã ghi nhận ${ok}/${pendC.length}`); onChanged?.();
    } else {
      // Single
      if (!task) return;
      if (!await confirmDialog({ title: 'Ghi nhận hoàn thành?', confirmText: 'Xác nhận', description: 'Đóng công việc dù chưa nộp.' })) return;
      setBusy('fc'); const r = await updateTaskStatus(task.id, 'done', '[sys] Đã hoàn thành.'); setBusy(null);
      if (!r.ok) { notifyError(r.error, 'Lỗi'); return; } notifySuccess('Đã cập nhật'); onChanged?.();
    }
  };

  const handleDelete = async () => {
    if (isBatch) {
      if (!await confirmDialog({ title: 'Xoá công việc?', confirmText: 'Xoá', danger: true, description: `Xoá ${children.length} việc?` })) return;
      setDeleting(true); let ok = 0, fe: string | undefined;
      for (const c of children) { const r = await deleteTask(c.id); if (r.ok) ok++; else if (!fe) fe = r.error; }
      setDeleting(false);
      if (ok === 0) { notifyError(fe ?? 'Lỗi', 'Lỗi'); return; }
      notifySuccess(`Đã xoá ${ok}/${children.length}`); setIsOpen(false); onChanged?.();
      setTimeout(() => document.body.style.pointerEvents = '', 500);
    } else {
      if (!task) return;
      if (!await confirmDialog({ title: 'Xoá công việc?', confirmText: 'Xoá', danger: true, description: `Xoá "${task.title}"?` })) return;
      setBusy('del'); const r = await deleteTask(task.id); setBusy(null);
      if (!r.ok) { notifyError(r.error, 'Lỗi'); return; } notifySuccess('Đã xoá'); onChanged?.(); setTimeout(() => setIsOpen(false), 100);
    }
  };

  const handleRemind = async () => {
    if (isBatch) {
      if (pendC.length === 0) return;
      if (!await confirmDialog({ title: 'Nhắc nhở hoàn thành?', confirmText: 'Nhắc nhở', description: `Gửi thông báo nhắc nhở đến người thực hiện của ${pendC.length} việc chưa hoàn thành.` })) return;
      setBusy('remind'); let ok = 0, fe: string | undefined;
      for (const c of pendC) { const r = await remindTask(c.id); if (r.ok) ok++; else if (!fe) fe = r.error; }
      setBusy(null);
      if (ok === 0) { notifyError(fe ?? 'Lỗi', 'Lỗi'); return; }
      notifySuccess(`Đã nhắc nhở ${ok}/${pendC.length} công việc`); onChanged?.();
    } else {
      if (!task) return;
      if (!await confirmDialog({ title: 'Nhắc nhở hoàn thành?', confirmText: 'Nhắc nhở', description: 'Gửi thông báo nhắc nhở đến người thực hiện chưa hoàn thành.' })) return;
      setBusy('remind'); const r = await remindTask(task.id); setBusy(null);
      if (!r.ok) { notifyError(r.error, 'Lỗi'); return; } notifySuccess('Đã gửi nhắc nhở'); refetch(); onChanged?.();
    }
  };

  // Quick-complete a single child in batch view
  const handleQuickComplete = async (child: TaskListItem) => {
    setBusy(child.id);
    if (child.status === 'todo') {
      const r1 = await updateTaskStatus(child.id, 'doing', '');
      if (!r1.ok) { setBusy(null); notifyError(r1.error ?? 'Lỗi', 'Lỗi'); return; }
    }
    const res = await updateTaskStatus(child.id, 'done', '[sys] Đã hoàn thành.');
    setBusy(null);
    if (res.ok) { notifySuccess(`Đã ghi nhận ${child.assignees?.[0]?.full_name ?? ''}`); onChanged?.(); }
    else notifyError(res.error ?? 'Lỗi', 'Lỗi');
  };

  if (!isOpen) return null;

  // ── Header data (unified) ──
  const hStatus = task?.status;
  const hTitle = task?.title ?? rep?.title ?? 'Đang tải…';
  const hCreator = task?.creator?.full_name ?? rep?.creator?.full_name;
  const hDueDate = task?.due_date ?? rep?.due_date;

  const hBadge = hStatus
    ? <Badge className={cn("bg-white/60 backdrop-blur-md shadow-sm font-bold text-xs px-3 py-1 w-fit", STATUS_BADGE_CLASS[hStatus])}>{STATUS_LABEL[hStatus]}</Badge>
    : null;

  // Dept info for batch
  const uniqueDepts = isBatch ? [...new Set(children.map(c => c.department?.name).filter(Boolean))] : [];
  const allSameDept = uniqueDepts.length === 1;

  const hMeta = [
    hCreator ? { text: hCreator } : null,
    hDueDate ? { text: `Hạn ${format(new Date(hDueDate), 'dd/MM/yyyy HH:mm', { locale: vi })}` } : null,
  ].filter(Boolean);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent hideCloseButton className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl flex flex-col p-0 gap-0">
        {/* ═══ HEADER ═══ */}
        <div className="px-[var(--app-page-x)] py-5 sm:p-6 relative backdrop-blur-xl border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white/60">
          <div className="relative z-10 space-y-2.5 max-w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">{hBadge}</div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsOpen(false)}
                  className="h-8 w-8 rounded-lg bg-white/60 backdrop-blur-md hover:bg-white flex items-center justify-center transition-all active:scale-95">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
            <DialogTitle className="text-lg sm:text-xl font-bold leading-tight text-slate-900 tabular-nums">
              {hTitle}
            </DialogTitle>
            {hMeta.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {hMeta.map((m: any, i: number) => (
                  <span key={i} className={cn("text-sm font-semibold", m.cls ?? 'text-slate-500')}>
                    {m.text}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Blur decoration */}
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/60 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* ═══ BODY ═══ */}
        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 space-y-5">

            {/* ─── 1. Tiến độ ─── */}
            {!loading && task && (
              <div className="space-y-2">
                <SectionLabel icon={<Flag className="w-4 h-4" />} label="Tiến độ" />
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  {/* Time-based progress bar (always shown) */}
                  <TaskDueProgress createdAt={task.created_at} dueDate={task.due_date} status={task.status} />
                  {task.priority !== 'medium' && (
                    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", PRIORITY_BADGE_CLASS[task.priority])}>
                      <Flag className="w-3 h-3" />{PRIORITY_LABEL[task.priority]}
                    </span>
                  )}
                  {/* Batch: additional completion ratio bar */}
                  {isBatch && bp && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      <div className="flex h-2 rounded-full overflow-hidden bg-white">
                        {bp.done > 0 && <div className="bg-emerald-500" style={{ width: `${(bp.done / bp.total) * 100}%` }} />}
                        {bp.submitted > 0 && <div className="bg-blue-400" style={{ width: `${(bp.submitted / bp.total) * 100}%` }} />}
                        {bp.doing > 0 && <div className="bg-amber-400" style={{ width: `${(bp.doing / bp.total) * 100}%` }} />}
                      </div>
                      <p className="text-xs font-semibold text-slate-500">
                        {bp.done + bp.submitted}/{bp.total} hoàn thành{bp.doing > 0 ? ` · ${bp.doing} đang làm` : ''}{bp.todo > 0 ? ` · ${bp.todo} chưa làm` : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── 2. Người thực hiện ─── */}
            <div className="space-y-2">
              <SectionLabel icon={<Users className="w-4 h-4" />} label="Người thực hiện" />
              {isBatch ? (
                /* ── Batch: expandable assignee list ── */
                <div className="space-y-2">
                  {/* Summary row */}
                  <button
                    onClick={() => setAssigneesExpanded(!assigneesExpanded)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-all"
                  >
                    <div className="flex -space-x-1.5">
                      {children.slice(0, 4).map((c, i) => (
                        <Avatar key={c.id} className="w-8 h-8 border-2 border-white">
                          <AvatarImage src={c.assignees?.[0]?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px] font-bold bg-slate-200 text-slate-600">
                            {c.assignees?.[0]?.full_name?.[0] ?? c.department?.name?.[0] ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {children.length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                          +{children.length - 4}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-slate-900">{allSameDept ? `${children.length} người` : `${uniqueDepts.length} phòng`}</p>
                      <p className="text-xs text-slate-500">{pendC.length > 0 ? `${pendC.length} chưa hoàn thành` : 'Tất cả đã hoàn thành'}</p>
                    </div>
                    {assigneesExpanded
                      ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    }
                  </button>
                  {/* Expanded list */}
                  {assigneesExpanded && (
                    <div className="space-y-1.5">
                      {sorted.map(c => {
                        const noAs = !c.assignees || c.assignees.length === 0;
                        const childCanFC = canForceCompleteTask(currentProfile, c as any);
                        const childCanApprove = canApproveTaskResult(currentProfile, c as any);
                        const isTodo = c.status === 'todo';
                        const isDoing = c.status === 'doing';
                        const isSubmitted = c.status === 'submitted';
                        const showQuick = (childCanFC && (isTodo || isDoing)) || (childCanApprove && isSubmitted);
                        return (
                          <div key={c.id}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-xl border transition-all',
                              c.is_overdue ? 'border-red-100 bg-red-50/40' : 'border-slate-100 bg-slate-50/40',
                            )}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {allSameDept && c.assignees?.[0] ? (
                                <Avatar className="w-9 h-9 shrink-0 border-2 border-white shadow-sm">
                                  <AvatarImage src={c.assignees[0].avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[11px] font-bold bg-slate-200 text-slate-600">{c.assignees[0].full_name?.[0] ?? '?'}</AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="p-2 bg-white rounded-xl shadow-sm shrink-0">
                                  <Building2 className={cn('w-4 h-4', c.is_overdue ? 'text-red-500' : 'text-slate-500')} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {allSameDept
                                    ? (c.assignees?.map((a: any) => a.full_name).filter(Boolean).join(', ') || c.department?.name || '—')
                                    : (c.department?.name ?? '—')
                                  }
                                </p>
                                {!allSameDept && (
                                  <p className={cn('text-xs font-medium', c.is_overdue ? 'text-red-600' : 'text-slate-500')}>
                                    {noAs ? 'Chưa phân công' : c.assignees!.map((a: any) => a.full_name).filter(Boolean).join(', ')}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 rounded-full border-slate-200 bg-white shrink-0">
                                {STATUS_LABEL[c.status]}
                              </Badge>
                            </div>
                            {showQuick && (
                              <button
                                onClick={() => handleQuickComplete(c)}
                                disabled={busy === c.id}
                                className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
                                title={isSubmitted ? 'Duyệt' : 'Ghi nhận hoàn thành'}
                              >
                                {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : task?.assignees && task.assignees.length > 0 ? (
                /* ── Single: inline assignees ── */
                <div className="bg-slate-50/40 rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1.5">
                      {task.assignees.slice(0, 5).map((a: any) => (
                        <Avatar key={a.id} className="w-8 h-8 border-2 border-white">
                          <AvatarImage src={a.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px] font-bold bg-slate-200 text-slate-600">{a.full_name?.[0] ?? '?'}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {task.assignees.length > 3
                          ? `${task.assignees.length} người`
                          : task.department?.id === currentProfile?.department_id
                            ? task.assignees.map((a: any) => a.full_name).filter(Boolean).join(', ')
                            : `${task.assignees.map((a: any) => a.full_name).filter(Boolean).join(', ')} · ${task.department?.name ?? ''}`
                        }
                      </p>
                    </div>
                    {task.requires_approval && (
                      <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2 py-0.5">Cần duyệt</Badge>
                    )}
                  </div>
                </div>
              ) : loading ? (
                <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : null}
            </div>

            {/* ─── 3. Mô tả ─── */}
            {task?.description && (
              <div className="space-y-2">
                <SectionLabel icon={<FileText className="w-4 h-4" />} label="Mô tả" />
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-4">
                  {task.description}
                </p>
              </div>
            )}

            {/* ─── 4. Bình luận ─── */}
            {task && (
              <div className="space-y-2 pt-1">
                <SectionLabel icon={<FileText className="w-4 h-4" />} label="Bình luận" />
                <div>
                  <TaskCommentList
                    taskId={task.id}
                    comments={task.comments.filter(c => {
                      const p = [/đã hoàn thành\.?$/, /trả lại\. Lý do:/, /trả về để sửa\. Lý do:/, /đã sửa:/, /^Đã hủy/, /^Đã hoàn thành\.?$/];
                      return !c.content.startsWith('[Hệ thống]') && !c.content.startsWith('[sys]') && !p.some(r => r.test(c.content));
                    })}
                    canCompose={!!currentProfile && canComposeTaskComment(currentProfile) && !ro}
                    onAdded={() => { refetch(); onChanged?.(); }}
                  />
                </div>
              </div>
            )}

            {/* ─── 5. Lịch sử ─── */}
            {task && (task.extension_requests?.length > 0 || task.comments.some(c => c.content.startsWith('[Hệ thống]') || c.content.startsWith('[sys]'))) && (
              <div className="space-y-2 pt-1">
                <SectionLabel icon={<Clock className="w-4 h-4" />} label="Lịch sử thay đổi" />
                <TaskTimeline task={task} />
              </div>
            )}

          </div>
        </div>

        {/* ═══ FOOTER — All actions consolidated here ═══ */}
        {task && (
        <DialogFooter className="app-dialog-sheet-footer flex flex-row items-center justify-between gap-2 overflow-hidden">
          {/* Secondary icon buttons — scrollable on mobile */}
          <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {canRemind && !ro && (
              <button onClick={handleRemind} disabled={busy !== null}
                title="Nhắc nhở"
                className="h-8 w-8 shrink-0 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50">
                {busy === 'remind' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> : <Bell className="w-3.5 h-3.5 text-amber-600" />}
              </button>
            )}
            {(canRj || canAp) && !ro && (
              <button onClick={() => setOpenRet(true)} disabled={busy !== null}
                title={canAp ? 'Trả về sửa' : 'Trả về'}
                className="h-8 w-8 shrink-0 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50">
                <Undo2 className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
            {canDl && (
              <button onClick={() => setOpenDelegate(true)} disabled={busy !== null}
                title={(task.assignees?.length ?? 0) === 0 ? 'Phân công' : 'Phân công lại'}
                className="h-8 w-8 shrink-0 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50">
                <Users className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
            {canRq && (
              <button onClick={() => setOpenExt(true)} disabled={busy !== null}
                title="Gia hạn"
                className="h-8 w-8 shrink-0 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
            {task && !task.is_archived && task.status === 'done' && canRp && (
              <button onClick={() => setOpenReo(true)} disabled={busy !== null}
                title="Mở lại"
                className="h-8 w-8 shrink-0 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
            {canEd && (
              <button onClick={() => setOpenEdit(true)}
                title="Sửa"
                className="h-8 w-8 shrink-0 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95">
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
            {canDe && (
              <button onClick={handleDelete} disabled={deleting || busy !== null}
                title="Xoá"
                className="h-8 w-8 shrink-0 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            )}
          </div>
          {/* Primary CTA — right-aligned, shrink to fit */}
          <div className="flex items-center gap-2 shrink-0">
            {canSub && (
              <button onClick={() => setOpenSub(true)} disabled={busy !== null}
                className="min-h-10 px-4 rounded-xl font-semibold text-sm text-white bg-primary hover:bg-primary/90 transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50">
                <Send className="w-4 h-4" /> <span className="hidden sm:inline">Gửi kết quả</span><span className="sm:hidden">Gửi</span>
              </button>
            )}
            {canAp && (
              <button onClick={() => setOpenApp(true)} disabled={busy !== null}
                className="min-h-10 px-4 rounded-xl font-semibold text-sm text-white bg-amber-600 hover:bg-amber-700 transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> Duyệt
              </button>
            )}
            {canS && !canSub && !canAp && (
              <button onClick={() => handleStatusChange('doing', 'start', 'Lỗi')} disabled={busy !== null}
                className="min-h-10 px-4 rounded-xl font-semibold text-sm text-white bg-primary hover:bg-primary/90 transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50">
                {busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} <span className="hidden sm:inline">Bắt đầu</span><span className="sm:hidden">Làm</span>
              </button>
            )}
            {canD && !canSub && !canAp && (
              <button onClick={() => handleStatusChange('done', 'done', 'Lỗi')} disabled={busy !== null}
                className="min-h-10 px-4 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50">
                {busy === 'done' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Xong
              </button>
            )}
            {!canS && !canD && !canSub && !canAp && (isBatch ? (bCanFC && pendC.length > 0) : canFC) && !ro && (
              <button onClick={handleForceComplete} disabled={deleting || busy !== null}
                className="min-h-10 px-4 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all active:scale-95 inline-flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Ghi nhận
              </button>
            )}
          </div>
        </DialogFooter>
        )}

        {/* ─── Sub-dialogs ─── */}
        {openEdit && task && (
          <TaskEditDialog task={{
            id: task.id, title: task.title,
            description: task.description ?? null, priority: task.priority,
            due_date: task.due_date ?? null, batch_id: task.batch_id ?? null,
            department_id: task.department_id ?? null,
            assignee_ids: task.assignees?.map((a: any) => a.id) ?? [],
            requires_approval: task.requires_approval ?? false,
          }} onClose={() => setOpenEdit(false)} onChanged={() => { setOpenEdit(false); onChanged?.(); }} />
        )}
        {openDelegate && task && <TaskDelegateDialog task={task} currentAssigneeIds={task.assignees?.map((a: any) => a.id) ?? []} onClose={() => setOpenDelegate(false)} onChanged={() => { setOpenDelegate(false); onChanged?.(); }} />}
        {openExt && task && <TaskRequestExtensionDialog task={task} onClose={() => setOpenExt(false)} onChanged={() => { setOpenExt(false); onChanged?.(); }} />}
        {openSub && task && <TaskSubmitResultDialog task={task} onClose={() => setOpenSub(false)} onChanged={() => { setOpenSub(false); onChanged?.(); }} />}
        {openRet && task && <TaskReturnDialog task={task} onClose={() => setOpenRet(false)} onChanged={() => { setOpenRet(false); onChanged?.(); }} />}
        {openReo && task && <TaskReopenDialog task={task} onClose={() => setOpenReo(false)} onChanged={() => { setOpenReo(false); onChanged?.(); }} />}
        {openApp && task && <TaskApproveDialog task={task} onClose={() => setOpenApp(false)} onChanged={() => { setOpenApp(false); onChanged?.(); }} />}
        {openAppExt && task && <TaskApproveExtensionDialog extension={openAppExt} onClose={() => setOpenAppExt(null)} onChanged={() => { setOpenAppExt(null); onChanged?.(); }} />}
      </DialogContent>
    </Dialog>
  );
}
