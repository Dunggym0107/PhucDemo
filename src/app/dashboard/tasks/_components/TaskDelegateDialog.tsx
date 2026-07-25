'use client';

// Dialog phân công lại NV (Manager+ giao công việc cấp phòng cho NV cụ thể).
// Dùng AssigneePicker collapsible — đồng bộ pattern với module Hồ sơ.

import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Users } from 'lucide-react';
import { useAppData } from '@/hooks/use-app-data';
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify';
import { delegateTask } from '../_lib/taskActions';
import { fetchAssignableProfiles } from '../_lib/fetchTasks';
import { getProfileDepartmentCode } from '@/lib/permissions';
import { PeoplePicker } from '@/components/ui/people-picker';

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

interface Props {
  task: { id: string; title: string; department_id: string | null };
  currentAssigneeIds: string[];
  onClose: () => void;
  onChanged: () => void;
}

export function TaskDelegateDialog({ task, currentAssigneeIds, onClose, onChanged }: Props) {
  const { currentProfile } = useAppData();
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [selected, setSelected] = useState<string[]>(currentAssigneeIds);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!currentProfile) return;
    setFetching(true);
    (async () => {
      if (task.department_id) {
        const list = await fetchAssignableProfiles({
          context: 'delegate',
          caller: {
            id: currentProfile.id,
            role: currentProfile.role ?? null,
            department_id: currentProfile.department_id ?? null,
            department_code: getProfileDepartmentCode(currentProfile),
          },
          taskDepartmentId: task.department_id,
        });
        setProfiles(list as ProfileItem[]);
      }
      setFetching(false);
    })();
  }, [currentProfile?.id, task.department_id]);

  const handleSubmit = async () => {
    if (selected.length === 0) {
      notifyValidation('Vui lòng chọn ít nhất một người nhận');
      return;
    }
    setLoading(true);
    const res = await delegateTask(task.id, selected);
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không phân công được');
      return;
    }
    notifySuccess('Đã phân công', `${selected.length} người sẽ nhận thông báo`);
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-lg font-semibold text-slate-900">
            Phân công công việc
          </DialogTitle>
          <DialogDescription className="text-subtitle line-clamp-1">
            {task.title}
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">
            {fetching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="icon-md animate-spin text-slate-500" />
              </div>
            ) : (
              <PeoplePicker
                profiles={profiles}
                myDepartmentId={currentProfile?.department_id ?? null}
                myDepartmentName={currentProfile?.departments?.name ?? null}
                selected={selected}
                onChange={setSelected}
                mode="multiple"
              />
            )}

            <p className="text-meta italic">
              Phân công lại sẽ thay thế toàn bộ danh sách hiện tại.
            </p>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between items-center gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="min-h-11 px-4 rounded-xl font-medium text-slate-500 text-sm"
          >
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || selected.length === 0}
            className="min-h-11 px-5 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white"
          >
            {loading ? <Loader2 className="icon-sm animate-spin" /> : (
              <>
                <Users className="icon-sm mr-1.5" />
                Phân công ({selected.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
