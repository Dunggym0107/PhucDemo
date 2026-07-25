'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import {
  Calendar, Flag, Loader2, Building2, User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { notifyError, notifyValidation, notifySuccess } from '@/lib/notify';
import {
  canCreateTaskAssignment,
  canTargetCrossDepartment,
  getProfileDepartmentCode,
  shouldDefaultAssignTaskToSelf,
} from '@/lib/permissions';
import { createTask } from '../_lib/taskActions';
import { fetchAssignableProfiles } from '../_lib/fetchTasks';
import { PeoplePicker } from '@/components/ui/people-picker';
import { DepartmentPicker } from '@/components/ui/department-picker';
import { TimePicker } from '@/components/ui/time-picker';
import type { TaskPriority } from '../_lib/types';

interface ProfileItem {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  title: string | null;
  department_id: string | null;
  is_department_head: boolean | null;
  departments?: { name?: string | null; code?: string | null } | null;
}


const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề'),
  description: z.string(),
  dueDate: z.date({ required_error: 'Vui lòng chọn hạn hoàn thành' }),
  priority: z.enum(['low', 'medium', 'high']),
  assignmentTarget: z.enum(['profile', 'department']),
  selectedAssignees: z.array(z.string()),
  selectedDepartments: z.array(z.string()),
  requiresApproval: z.boolean(),
});

type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

// Mặc định deadline = cuối giờ làm (17:00) cùng ngày để không bị 00:00 vô nghĩa.
function defaultDueDate(): Date {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  return d;
}

function defaultValues(profile?: { id: string; role?: string | null } | null): CreateTaskFormValues {
  return {
    title: '',
    description: '',
    dueDate: defaultDueDate(),
    priority: 'medium',
    assignmentTarget: 'department',
    selectedAssignees: [],
    selectedDepartments: [],
    requiresApproval: false,
  };
}

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  onCreated?: () => void;
}

export function CreateTaskDialog({ isOpen, setIsOpen, onCreated }: Props) {
  const { currentProfile, departments: cachedDepts } = useAppData();
  const profile = currentProfile;
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: defaultValues(profile),
  });

  const dueDate = form.watch('dueDate');
  const priority = form.watch('priority');
  const assignmentTarget = form.watch('assignmentTarget');
  const selectedAssignees = form.watch('selectedAssignees');
  const selectedDepartments = form.watch('selectedDepartments');
  const requiresApproval = form.watch('requiresApproval');

  const canCreateAssignment = canCreateTaskAssignment(profile);
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
    if (!isOpen) return;
    form.reset(defaultValues(profile));
  }, [isOpen, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen || !profile) return;
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
      setProfiles(list as ProfileItem[]);
      if (shouldDefaultAssignTaskToSelf(profile)) {
        form.setValue('selectedAssignees', [profile.id], { shouldValidate: true });
      }
      setFetching(false);
    })();
    return () => { active = false; };
  }, [isOpen, profile?.id, cachedDepts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canCrossDept) form.setValue('assignmentTarget', 'profile');
  }, [canCrossDept, form]);

  useEffect(() => {
    const next = selectedDepartments.filter(id => receiverDepartmentIds.has(id));
    if (next.length !== selectedDepartments.length) {
      form.setValue('selectedDepartments', next, { shouldValidate: true });
    }
  }, [selectedDepartments, receiverDepartmentIds, form]);

  const resetForm = () => form.reset(defaultValues(profile));

  const handleClose = () => {
    if (loading) return;
    resetForm();
    setIsOpen(false);
  };

  const handleInvalid = (errors: typeof form.formState.errors) => {
    const first = errors.title?.message || errors.dueDate?.message;
    notifyValidation(first ? String(first) : 'Vui lòng kiểm tra lại thông tin');
  };

  const handleSubmit = async (values: CreateTaskFormValues) => {
    setLoading(true);
    try {
      if (values.assignmentTarget === 'department') {
        if (values.selectedDepartments.length === 0) {
          notifyValidation('Vui lòng chọn ít nhất một phòng ban');
          setLoading(false); return;
        }
        const batchId = values.selectedDepartments.length > 1 ? crypto.randomUUID() : null;
        for (const deptId of values.selectedDepartments) {
          const res = await createTask({
            title: values.title.trim(),
            description: values.description.trim() || null,
            priority: values.priority,
            due_date: values.dueDate.toISOString(),
            dept_id: deptId,
            assignee_ids: null,
            requires_approval: values.requiresApproval,
            batch_id: batchId,
          });
          if (!res.ok) {
            notifyError(res.error, 'Không tạo được công việc');
            setLoading(false); return;
          }
        }
        notifySuccess(
          'Đã tạo công việc',
          `${values.selectedDepartments.length} phòng sẽ nhận công việc`,
        );
      } else {
        if (values.selectedAssignees.length === 0) {
          notifyValidation('Vui lòng chọn người nhận');
          setLoading(false); return;
        }
        const batchId = values.selectedAssignees.length > 1 ? crypto.randomUUID() : null;
        for (const userId of values.selectedAssignees) {
          const assignee = profiles.find(x => x.id === userId);
          const deptId = assignee?.department_id ?? profile?.department_id ?? null;
          const res = await createTask({
            title: values.title.trim(),
            description: values.description.trim() || null,
            priority: values.priority,
            due_date: values.dueDate.toISOString(),
            dept_id: deptId,
            assignee_ids: [userId],
            requires_approval: values.requiresApproval,
            batch_id: batchId,
          });
          if (!res.ok) { notifyError(res.error, 'Không tạo được công việc'); setLoading(false); return; }
        }
        notifySuccess('Đã tạo công việc', `${values.selectedAssignees.length} cán bộ sẽ nhận công việc`);
      }
      resetForm();
      setIsOpen(false);
      onCreated?.();
    } catch (err: any) {
      notifyError(err, 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">
            Tạo công việc
          </DialogTitle>
          <DialogDescription className="text-subtitle">
            Chọn phòng nhận việc hoặc người thực hiện trong phòng.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit, handleInvalid)} className="contents">
          <div className="app-dialog-sheet-body">
            <div className="px-[var(--app-page-x)] py-4 group-stack">

              <div className="tight-stack">
                <Label className="text-label">Tiêu đề</Label>
                <Input
                  placeholder="Tên công việc..."
                  {...form.register('title')}
                  className="min-h-11 rounded-xl bg-slate-50 border-none px-4"
                />
              </div>

              <div className="tight-stack">
                <Label className="text-label">Mô tả</Label>
                <Textarea
                  rows={3}
                  {...form.register('description')}
                  placeholder="Nội dung, yêu cầu, lưu ý khi thực hiện..."
                  className="rounded-xl bg-slate-50 border-none resize-none px-4 py-3"
                />
              </div>

              <div className="group-stack">
                <Label className="text-label">Cách giao việc</Label>

                {canCrossDept && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => form.setValue('assignmentTarget', 'department', { shouldValidate: true })}
                      className={cn(
                        'min-h-16 p-3 rounded-xl border text-left transition-all',
                        assignmentTarget === 'department'
                          ? 'bg-primary/10 border-primary'
                          : 'bg-white border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      <label className="flex items-center gap-2">
                        <Building2 className="icon-md text-amber-500" />
                        <span className="heading-card">Phòng khác</span>
                      </label>
                    </button>
                    <button
                      type="button"
                      onClick={() => form.setValue('assignmentTarget', 'profile', { shouldValidate: true })}
                      className={cn(
                        'min-h-16 p-3 rounded-xl border text-left transition-all',
                        assignmentTarget === 'profile'
                          ? 'bg-primary/10 border-primary'
                          : 'bg-white border-slate-200 hover:bg-slate-50',
                      )}
                    >
                      <label className="flex items-center gap-2">
                        <UserIcon className="icon-md text-primary" />
                        <span className="heading-card">Trong phòng</span>
                      </label>
                    </button>
                  </div>
                )}

                {fetching ? (
                  <label className="flex items-center justify-center py-6">
                    <Loader2 className="icon-md animate-spin text-slate-500" />
                  </label>
                ) : assignmentTarget === 'department' ? (
                  <DepartmentPicker
                    items={receiverDepartments}
                    selected={selectedDepartments}
                    onChange={(ids) => form.setValue('selectedDepartments', ids, { shouldValidate: true })}
                    triggerLabel="Chọn phòng nhận"
                  />
                ) : (
                  <PeoplePicker
                    profiles={profiles}
                    currentUserId={profile?.id}
                    myDepartmentId={profile?.department_id ?? null}
                    myDepartmentName={profile?.departments?.name ?? null}
                    selected={selectedAssignees}
                    onChange={(ids) => form.setValue('selectedAssignees', ids, { shouldValidate: true })}
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
                          type="button"
                          variant="outline"
                          className="w-full min-h-11 rounded-xl bg-slate-50 border-none font-medium justify-start px-4 shadow-none hover:bg-slate-100 text-slate-900"
                        >
                          <Calendar className="icon-sm mr-2 text-slate-500" />
                          {format(dueDate, 'dd/MM/yyyy', { locale: vi })}
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
                            if (!d) return;
                            const next = new Date(d);
                            next.setHours(dueDate.getHours(), dueDate.getMinutes(), 0, 0);
                            form.setValue('dueDate', next, { shouldValidate: true });
                            setIsDateOpen(false);
                          }}
                          initialFocus
                          locale={vi}
                        />
                      </PopoverContent>
                    </Popover>

                    <TimePicker
                      value={format(dueDate, 'HH:mm')}
                      onChange={(v) => {
                        const [h, m] = v.split(':').map(Number);
                        const next = new Date(dueDate);
                        next.setHours(h, m, 0, 0);
                        form.setValue('dueDate', next, { shouldValidate: true });
                      }}
                      triggerClassName="w-full"
                    />
                  </div>
                </div>

                <div className="tight-stack">
                  <Label className="text-label">Mức độ ưu tiên</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => form.setValue('priority', v as TaskPriority, { shouldValidate: true })}
                  >
                    <SelectTrigger className="min-h-11 rounded-xl bg-slate-50 border-none font-medium px-4">
                      <label className="flex items-center gap-2">
                        <Flag className={cn(
                          'icon-sm',
                          priority === 'high' ? 'text-red-500' :
                            priority === 'low' ? 'text-slate-500' : 'text-slate-500',
                        )} />
                        <SelectValue />
                      </label>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                      <SelectItem value="low">Ưu tiên thấp</SelectItem>
                      <SelectItem value="medium">Bình thường</SelectItem>
                      <SelectItem value="high">Khẩn trương</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 cursor-pointer">
                  <Switch
                    checked={requiresApproval}
                    onCheckedChange={(v) => form.setValue('requiresApproval', v, { shouldValidate: true })}
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

          <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={loading}
              className="min-h-11 px-4 rounded-xl font-medium text-slate-500"
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="min-h-11 px-5 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white"
            >
              {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Tạo công việc'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
