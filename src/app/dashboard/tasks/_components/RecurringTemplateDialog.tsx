'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Flag, Building2, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { notifyError, notifyValidation, notifySuccess } from '@/lib/notify';
import {
  canTargetCrossDepartment,
  getProfileDepartmentCode,
} from '@/lib/permissions';
import { upsertRecurringTemplate } from '../_lib/recurringActions';
import { fetchAssignableProfiles } from '../_lib/fetchTasks';
import { PeoplePicker } from '@/components/ui/people-picker';
import { DepartmentPicker } from '@/components/ui/department-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { CronScheduleSelector } from './CronScheduleSelector';
import type { RecurringTemplate, ScheduleKind } from '../_lib/recurringHelpers';
import type { TaskPriority } from '../_lib/types';

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  editing?: RecurringTemplate | null;
  onSaved?: () => void;
}

export function RecurringTemplateDialog({ isOpen, setIsOpen, editing, onSaved }: Props) {
  const { currentProfile, departments: cachedDepts } = useAppData();
  const profile = currentProfile;
  const [profiles, setProfiles] = useState<any[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [target, setTarget] = useState<'department' | 'profile'>('department');
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [kind, setKind] = useState<ScheduleKind>('weekly');
  const [weeklyDow, setWeeklyDow] = useState<number | null>(5);
  const [weeklyTime, setWeeklyTime] = useState('15:00');
  const [monthlyDom, setMonthlyDom] = useState<number | null>(1);
  const [monthlyTime, setMonthlyTime] = useState('09:00');
  const [dueDays, setDueDays] = useState(7);
  const [dueTime, setDueTime] = useState('17:00');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !profile) return;
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
      setProfiles(list);
    })();
  }, [isOpen, profile?.id, cachedDepts]);

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setPriority(editing.priority);
      setDeptIds(editing.target_department_ids ?? []);
      setUserIds(editing.target_user_ids ?? []);
      setTarget(editing.target_user_ids?.length > 0 ? 'profile' : 'department');
      setKind(editing.schedule_kind);
      setWeeklyDow(editing.weekly_dow);
      setWeeklyTime(editing.weekly_time?.slice(0, 5) ?? '15:00');
      setMonthlyDom(editing.monthly_dom);
      setMonthlyTime(editing.monthly_time?.slice(0, 5) ?? '09:00');
      setDueDays(editing.due_days_after_fire);
      setDueTime(editing.due_time?.slice(0, 5) ?? '17:00');
    } else {
      setTitle(''); setDescription('');
      setPriority('medium');
      setTarget('department'); setDeptIds([]); setUserIds([]);
      setKind('weekly'); setWeeklyDow(5); setWeeklyTime('15:00');
      setMonthlyDom(1); setMonthlyTime('09:00');
      setDueDays(7);
    }
  }, [isOpen, editing]);

  const canCrossDept = canTargetCrossDepartment(profile);
  const receiverDepartments = useMemo(
    () => cachedDepts.filter((d: any) => d.code !== '13601'),
    [cachedDepts],
  );
  const receiverDepartmentIds = useMemo(
    () => new Set(receiverDepartments.map((d: any) => d.id)),
    [receiverDepartments],
  );

  // Nếu không cross-dept thì force chọn cá nhân (cá nhân đã filter sẵn phòng mình).
  useEffect(() => {
    if (!canCrossDept) setTarget('profile');
  }, [canCrossDept]);

  useEffect(() => {
    setDeptIds(prev => prev.filter(id => receiverDepartmentIds.has(id)));
  }, [receiverDepartmentIds]);

  const handleSave = async () => {
    if (!title.trim()) { notifyValidation('Vui lòng nhập tiêu đề'); return; }
    if (target === 'department' && deptIds.length === 0) {
      notifyValidation('Vui lòng chọn phòng ban nhận');
      return;
    }
    if (target === 'profile' && userIds.length === 0) {
      notifyValidation('Vui lòng chọn cán bộ nhận');
      return;
    }
    if (kind === 'weekly' && (weeklyDow === null || !weeklyTime)) {
      notifyValidation('Vui lòng chọn thứ và giờ');
      return;
    }
    if (kind === 'monthly' && (monthlyDom === null || !monthlyTime)) {
      notifyValidation('Vui lòng chọn ngày và giờ');
      return;
    }

    setLoading(true);
    const res = await upsertRecurringTemplate({
      id: editing?.id ?? null,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      target_department_ids: target === 'department' ? deptIds : [],
      target_user_ids: target === 'profile' ? userIds : [],
      schedule_kind: kind,
      weekly_dow: kind === 'weekly' ? weeklyDow : null,
      weekly_time: kind === 'weekly' ? weeklyTime : null,
      monthly_dom: kind === 'monthly' ? monthlyDom : null,
      monthly_time: kind === 'monthly' ? monthlyTime : null,
      due_days_after_fire: dueDays,
      due_time: dueTime,
      is_active: editing?.is_active ?? true,
    });
    setLoading(false);
    if (!res.ok) { notifyError(res.error, 'Không lưu được mẫu định kỳ'); return; }
    notifySuccess(editing ? 'Đã cập nhật' : 'Đã tạo mẫu định kỳ');
    onSaved?.();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-[17px] font-bold text-slate-900">
            {editing ? 'Sửa công việc định kỳ' : 'Công việc định kỳ'}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Hệ thống tự sinh công việc theo lịch cho phòng nhận hoặc người thực hiện.
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Tiêu đề</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tên công việc sinh ra mỗi kỳ..."
                className="min-h-11 rounded-xl bg-slate-50 border-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Mô tả</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nội dung, yêu cầu, lưu ý khi thực hiện..."
                className="rounded-xl bg-slate-50 border-none resize-none"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-semibold text-slate-500">{target === 'profile' ? 'Người nhận' : 'Cách giao việc'}</Label>
              {canCrossDept && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTarget('department')}
                    className={cn(
                      'min-h-14 p-3 rounded-xl border text-left transition-all active:scale-[0.98]',
                      target === 'department'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-white border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-slate-900">Phòng khác</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTarget('profile')}
                    className={cn(
                      'min-h-14 p-3 rounded-xl border text-left transition-all active:scale-[0.98]',
                      target === 'profile'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-white border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-slate-900">Trong phòng</span>
                    </div>
                  </button>
                </div>
              )}
              {target === 'department' ? (
                <DepartmentPicker
                  items={receiverDepartments}
                  selected={deptIds}
                  onChange={setDeptIds}
                  triggerLabel="Chọn phòng nhận"
                />
              ) : (
                <PeoplePicker
                  profiles={profiles}
                  currentUserId={profile?.id}
                  myDepartmentId={profile?.department_id ?? null}
                  myDepartmentName={profile?.departments?.name ?? null}
                  selected={userIds}
                  onChange={setUserIds}
                  mode="multiple"
                />
              )}
            </div>


            <div className="space-y-3">
              <Label className="text-xs font-semibold text-slate-500">Lịch sinh</Label>
              <CronScheduleSelector
                kind={kind}
                onKindChange={setKind}
                weeklyDow={weeklyDow}
                onWeeklyDowChange={setWeeklyDow}
                weeklyTime={weeklyTime}
                onWeeklyTimeChange={setWeeklyTime}
                monthlyDom={monthlyDom}
                onMonthlyDomChange={setMonthlyDom}
                monthlyTime={monthlyTime}
                onMonthlyTimeChange={setMonthlyTime}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Hạn nộp = sau N ngày</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={dueDays}
                  onChange={(e) => setDueDays(Number(e.target.value))}
                  className="min-h-11 rounded-xl bg-slate-50 border-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500">Giờ hạn nộp</Label>
                <TimePicker value={dueTime} onChange={setDueTime} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">Mức độ ưu tiên</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger className="min-h-11 rounded-xl bg-slate-50 border-none">
                    <div className="flex items-center gap-2">
                      <Flag className={cn('w-4 h-4',
                        priority === 'high' ? 'text-red-500' : 'text-slate-500')} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="low">Thấp</SelectItem>
                    <SelectItem value="medium">Bình thường</SelectItem>
                    <SelectItem value="high">Khẩn trương</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between gap-2">
          <button onClick={() => setIsOpen(false)} disabled={loading}
            className="min-h-11 px-4 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-50">Huỷ</button>
          <button onClick={handleSave} disabled={loading}
            className="min-h-11 px-5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 shadow-sm inline-flex items-center gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {editing ? 'Cập nhật' : 'Tạo'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
