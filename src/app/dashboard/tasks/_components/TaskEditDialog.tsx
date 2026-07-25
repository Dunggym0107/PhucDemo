'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Flag, Loader2, Building2, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify';
import {
  canTargetCrossDepartment,
  getProfileDepartmentCode,
} from '@/lib/permissions';
import { updateTask } from '../_lib/taskActions';
import { fetchBatchSiblings, fetchAssignableProfiles } from '../_lib/fetchTasks';
import { batchScopeDialog } from '@/components/ui/batch-scope-dialog';
import { PeoplePicker } from '@/components/ui/people-picker';
import { DepartmentPicker } from '@/components/ui/department-picker';
import { TimePicker } from '@/components/ui/time-picker';
import type { TaskPriority } from '../_lib/types';

interface Props {
  task: {
    id: string;
    title: string;
    description: string | null;
    priority: TaskPriority;
    due_date: string | null;
    batch_id: string | null;
    department_id: string | null;
    assignee_ids: string[];
    requires_approval: boolean;
  };
  onClose: () => void;
  onChanged: () => void;
}

export function TaskEditDialog({ task, onClose, onChanged }: Props) {
  const { currentProfile, departments: cachedDepts } = useAppData();
  const profile = currentProfile;
  const [profiles, setProfiles] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.due_date ? new Date(task.due_date) : undefined,
  );

  const initialTarget = task.assignee_ids.length > 0 ? 'profile' : 'department';
  const [assignmentTarget, setAssignmentTarget] = useState<'profile' | 'department'>(initialTarget);

  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    initialTarget === 'profile' ? task.assignee_ids : []
  );
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(
    initialTarget === 'department' && task.department_id ? [task.department_id] : []
  );
  const [requiresApproval, setRequiresApproval] = useState(task.requires_approval);

  const [loading, setLoading] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const canCrossDept = canTargetCrossDepartment(profile);
  const receiverDepartments = useMemo(
    () => cachedDepts.filter((d: any) => d.code !== '13601'),
    [cachedDepts],
  );
  const receiverDepartmentIds = useMemo(
    () => new Set(receiverDepartments.map((d: any) => d.id)),
    [receiverDepartments],
  );

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setFetching(true);
    (async () => {
      const list = await fetchAssignableProfiles({
        context: 'create-assignment',
        caller: {
          id: profile.id,
          role: profile.role ?? null,
          department_id: profile.department_id ?? null,
          department_code: getProfileDepartmentCode(profile),
        },
      });
      if (!active) return;
      setProfiles(list as any[]);
      setFetching(false);
    })();
    return () => { active = false; };
  }, [profile?.id, cachedDepts]);

  useEffect(() => {
    if (!canCrossDept) setAssignmentTarget('profile');
  }, [canCrossDept]);

  useEffect(() => {
    const next = selectedDepartments.filter(id => receiverDepartmentIds.has(id));
    if (next.length !== selectedDepartments.length) {
      setSelectedDepartments(next);
    }
  }, [selectedDepartments, receiverDepartmentIds]);

  const handleSubmit = async () => {
    if (!title.trim()) { notifyValidation('Vui lòng nhập tiêu đề'); return; }
    if (!dueDate) { notifyValidation('Vui lòng chọn hạn hoàn thành'); return; }

    let deptId = null;
    let assigneeIds = null;

    if (assignmentTarget === 'department') {
      if (selectedDepartments.length === 0) {
        notifyValidation('Vui lòng chọn ít nhất một phòng ban');
        return;
      }
      deptId = selectedDepartments[0];
    } else {
      if (selectedAssignees.length === 0) {
        notifyValidation('Vui lòng chọn người nhận');
        return;
      }
      assigneeIds = selectedAssignees;
      const assignee = profiles.find(x => x.id === selectedAssignees[0]);
      deptId = assignee?.department_id ?? profile?.department_id ?? null;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_date: dueDate.toISOString(),
      department_id: deptId,
      assignee_ids: assigneeIds,
      requires_approval: requiresApproval,
    };

    if (task.batch_id) {
      setLoading(true);
      const siblings = await fetchBatchSiblings(task.batch_id);
      const editable = siblings.filter(s => s.status !== 'canceled' && !s.is_archived);
      setLoading(false);

      if (editable.length <= 1) {
        await runSave([task.id], payload);
        return;
      }

      const scope = await batchScopeDialog({
        title: 'Áp thay đổi cho cả lô?',
        description: `Công việc này nằm trong một lô gửi đến ${editable.length} phòng. Áp thay đổi cho cả lô — hay chỉ task này?`,
        batchSize: editable.length,
      });
      if (scope === null) return;

      const ids = scope === 'batch' ? editable.map(s => s.id) : [task.id];
      await runSave(ids, payload);
      return;
    }

    await runSave([task.id], payload);
  };

  const runSave = async (
    taskIds: string[],
    payload: {
      title: string;
      description: string | null;
      priority: TaskPriority;
      due_date: string;
      department_id: string | null;
      assignee_ids: string[] | null;
      requires_approval: boolean;
    },
  ) => {
    setLoading(true);
    let okCount = 0;
    let firstError: string | null = null;
    for (const id of taskIds) {
      const res = await updateTask(id, payload);
      if (res.ok) okCount += 1;
      else if (!firstError) firstError = res.error;
    }
    setLoading(false);

    if (okCount === 0) {
      notifyError(firstError ?? 'Lỗi không xác định', 'Không lưu được');
      return;
    }
    if (taskIds.length === 1) {
      notifySuccess('Đã cập nhật');
    } else {
      const skipped = taskIds.length - okCount;
      notifySuccess(
        `Đã cập nhật ${okCount}/${taskIds.length} task trong lô`,
        skipped > 0 ? `${skipped} task bỏ qua do lỗi quyền hoặc trạng thái` : undefined,
      );
    }
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">Sửa công việc</DialogTitle>
          <DialogDescription className="text-subtitle">
            Chỉnh sửa các trường thông tin của công việc.
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">
            <div className="tight-stack">
              <Label className="text-label">Tiêu đề</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-11 rounded-xl bg-slate-50 border-none px-4"
                autoFocus
              />
            </div>

            <div className="tight-stack">
              <Label className="text-label">Mô tả</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kế hoạch, yêu cầu, mục tiêu công việc..."
                className="rounded-xl bg-slate-50 border-none resize-none px-4 py-3"
              />
            </div>

            <div className="group-stack">
              <Label className="text-label">Cách giao việc</Label>

              {canCrossDept && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentTarget('department');
                      setSelectedAssignees([]);
                    }}
                    className={cn(
                      'min-h-16 p-3 rounded-xl border text-left transition-all',
                      assignmentTarget === 'department'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-white border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="icon-md text-amber-500" />
                      <span className="heading-card">Phòng khác</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentTarget('profile');
                      setSelectedDepartments([]);
                    }}
                    className={cn(
                      'min-h-16 p-3 rounded-xl border text-left transition-all',
                      assignmentTarget === 'profile'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-white border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <UserIcon className="icon-md text-primary" />
                      <span className="heading-card">Trong phòng</span>
                    </div>
                  </button>
                </div>
              )}

              {fetching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="icon-md animate-spin text-slate-500" />
                </div>
              ) : assignmentTarget === 'department' ? (
                <DepartmentPicker
                  items={receiverDepartments}
                  selected={selectedDepartments}
                  onChange={(ids) => setSelectedDepartments(ids)}
                  triggerLabel="Chọn phòng nhận"
                />
              ) : (
                <PeoplePicker
                  profiles={profiles}
                  currentUserId={profile?.id}
                  myDepartmentId={profile?.department_id ?? null}
                  myDepartmentName={profile?.departments?.name ?? null}
                  selected={selectedAssignees}
                  onChange={(ids) => setSelectedAssignees(ids)}
                  mode="multiple"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="tight-stack">
                <Label className="text-label">Hạn hoàn thành</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full min-h-11 rounded-xl bg-slate-50 border-none font-medium justify-start px-4 shadow-none hover:bg-slate-100 text-slate-900',
                          !dueDate && 'text-slate-500',
                        )}
                      >
                        <Calendar className="icon-sm mr-2 text-slate-500" />
                        {dueDate ? format(dueDate, 'dd/MM/yyyy', { locale: vi }) : 'Chọn ngày'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <CalendarPicker
                        mode="single"
                        selected={dueDate}
                        onSelect={(d) => {
                          if (!d) { setDueDate(undefined); return; }
                          const next = new Date(d);
                          next.setHours(
                            dueDate?.getHours() ?? 17,
                            dueDate?.getMinutes() ?? 0,
                            0, 0,
                          );
                          setDueDate(next);
                          setIsDateOpen(false);
                        }}
                        initialFocus
                        locale={vi}
                      />
                    </PopoverContent>
                  </Popover>

                  <TimePicker
                    value={dueDate ? format(dueDate, 'HH:mm') : '17:00'}
                    onChange={(v) => {
                      const [h, m] = v.split(':').map(Number);
                      const base = dueDate ?? new Date();
                      const next = new Date(base);
                      next.setHours(h, m, 0, 0);
                      setDueDate(next);
                    }}
                    triggerClassName="w-full"
                  />
                </div>
              </div>

              <div className="tight-stack">
                <Label className="text-label">Mức độ ưu tiên</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger className="min-h-11 rounded-xl bg-slate-50 border-none font-medium px-4">
                    <div className="flex items-center gap-2">
                      <Flag className={cn(
                        'icon-sm',
                        priority === 'high' ? 'text-red-500' :
                          priority === 'low' ? 'text-slate-500' : 'text-slate-500',
                      )} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                    <SelectItem value="low">Ưu tiên thấp</SelectItem>
                    <SelectItem value="medium">Bình thường</SelectItem>
                    <SelectItem value="high">Khẩn trương</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 cursor-pointer">
                <Switch
                  checked={requiresApproval}
                  onCheckedChange={setRequiresApproval}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-subtitle font-semibold text-slate-900">Cần Trưởng phòng duyệt kết quả</p>
                  <p className="text-meta">
                    Mặc định tắt — hoàn thành xong là ghi nhận luôn. Bật khi cần kiểm soát chặt.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="min-h-11 px-4 rounded-xl font-medium text-slate-500"
          >
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="min-h-11 px-5 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white"
          >
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Lưu thay đổi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
