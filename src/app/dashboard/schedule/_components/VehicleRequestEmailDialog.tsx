'use client'

import React, { useState, useMemo } from 'react';
import { Mail, Send, Loader2, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { notifyError, notifySuccess } from '@/lib/notify';

interface VehicleRequestEmailDialogProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  schedule: any;
}

function SelectCircle({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border transition-colors shrink-0',
        checked
          ? 'border-primary bg-primary'
          : 'border-slate-300 bg-white'
      )}
    >
      {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
    </span>
  );
}

export default function VehicleRequestEmailDialog({
  isOpen,
  setIsOpen,
  schedule,
}: VehicleRequestEmailDialogProps) {
  const [recipients, setRecipients] = useState('');
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Participants from schedule
  const participants = useMemo(() => {
    const list: { id: string; full_name: string; role: string; title: string }[] = [];
    const seen = new Set<string>();

    if (schedule?.creator?.id && schedule?.creator?.full_name) {
      list.push({
        id: schedule.creator.id,
        full_name: schedule.creator.full_name,
        role: schedule.creator.role || '',
        title: schedule.creator.title || '',
      });
      seen.add(schedule.creator.id);
    }

    if (schedule?.participants) {
      for (const p of schedule.participants) {
        const profile = p.profile;
        if (profile?.id && profile?.full_name && !seen.has(profile.id)) {
          list.push({
            id: profile.id,
            full_name: profile.full_name,
            role: profile.role || '',
            title: profile.title || '',
          });
          seen.add(profile.id);
        }
      }
    }

    return list;
  }, [schedule]);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedProfiles(new Set());
      setRecipients('');
    }
  }, [isOpen]);

  const toggleProfile = (id: string) => {
    setSelectedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    const emailList = recipients
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emailList.filter((e) => !emailRegex.test(e));
    if (invalid.length > 0) {
      notifyError(`Email không hợp lệ: ${invalid.join(', ')}`);
      return;
    }

    const profileIds = Array.from(selectedProfiles);

    if (emailList.length === 0 && profileIds.length === 0) {
      notifyError('Vui lòng chọn người nhận từ danh sách hoặc nhập email.');
      return;
    }

    setSending(true);

    try {
      const res = await fetch('/api/schedules/export-vehicle-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: schedule.id,
          recipients: emailList,
          profileIds,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi không xác định');
      }

      notifySuccess('Đã gửi email thành công', 'Giấy đề nghị xe đã được gửi tới người nhận.');
      setIsOpen(false);
    } catch (err: any) {
      notifyError(err, 'Gửi email thất bại');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--md shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Gửi email đề nghị xe
          </DialogTitle>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="space-y-4 px-[var(--app-page-x)] py-3">

            {/* Schedule info */}
            <div className="text-sm space-y-0.5">
              <p className="font-semibold text-slate-800">{schedule?.title || ''}</p>
              <p className="text-xs text-slate-500">
                {schedule?.start_time
                  ? new Date(schedule.start_time).toLocaleString('vi-VN', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : ''}
                {schedule?.location ? ` — ${schedule.location}` : ''}
              </p>
            </div>

            {/* Compact participant list with circles */}
            {participants.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                  Chọn người nhận
                </p>
                <div className="bg-slate-50/70 rounded-xl">
                  <ScrollArea className="max-h-[180px]">
                    <div className="py-1">
                      {participants.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                            selectedProfiles.has(p.id) ? 'text-primary font-semibold' : 'text-slate-600 hover:text-slate-800'
                          )}
                          onClick={() => toggleProfile(p.id)}
                        >
                          <SelectCircle checked={selectedProfiles.has(p.id)} />
                          <User className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span className="truncate">{p.full_name}</span>
                          {p.title && (
                            <span className="text-meta truncate ml-auto">{p.title}</span>
                          )}
                          {idx === 0 && (
                            <span className="text-xs text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                              ĐK
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {/* Manual email input */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                Hoặc nhập email trực tiếp
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <Input
                  placeholder="email1@vietinbank.vn, email2@vietinbank.vn"
                  className="h-9 bg-slate-50 border-none rounded-lg text-xs pl-8 pr-3"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  disabled={sending}
                />
              </div>
            </div>

          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg text-xs text-slate-500 bg-slate-100 hover:bg-slate-200"
            onClick={handleClose}
            disabled={sending}
          >
            <X className="w-3 h-3 mr-1" />
            Đóng
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || (recipients.trim().length === 0 && selectedProfiles.size === 0)}
            size="sm"
            className="rounded-lg text-xs shadow-sm"
          >
            {sending ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                Đang gửi...
              </>
            ) : (
              <>
                <Send className="w-3 h-3 mr-1.5" />
                Gửi ({selectedProfiles.size + recipients.split(/[,;\n]/).filter(Boolean).length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
