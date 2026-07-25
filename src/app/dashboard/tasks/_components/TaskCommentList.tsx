'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { notifyError, notifyValidation } from '@/lib/notify';
import { addComment } from '../_lib/taskActions';
import type { TaskDetail } from '../_lib/types';

interface Props {
  taskId: string;
  comments: TaskDetail['comments'];
  onAdded: () => void;
  canCompose?: boolean;
}

export function TaskCommentList({ taskId, comments, onAdded, canCompose = true }: Props) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!body.trim()) { notifyValidation('Vui lòng nhập nội dung'); return; }
    setBusy(true);
    const res = await addComment(taskId, body.trim());
    setBusy(false);
    if (!res.ok) { notifyError(res.error, 'Không gửi được bình luận'); return; }
    setBody('');
    onAdded();
  };

  const disabled = busy || !body.trim();

  return (
    <div className="space-y-3">
      {/* Danh sách bình luận */}
      {comments.length === 0 ? (
        <p className="text-xs font-medium text-slate-400 italic py-1 px-1">Chưa có bình luận</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 p-3 bg-white rounded-xl border border-slate-100">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={c.user?.avatar_url ?? undefined} alt={c.user?.full_name ?? ''} />
                <AvatarFallback className="text-[11px] font-bold bg-slate-200 text-slate-600">
                  {c.user?.full_name?.charAt(0) ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-slate-900 truncate">{c.user?.full_name ?? '—'}</span>
                  <span className="text-xs font-medium text-slate-400 shrink-0">
                    {format(new Date(c.created_at), 'HH:mm dd/MM', { locale: vi })}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                  {c.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        {canCompose ? (
          <>
            <Textarea
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Viết bình luận..."
              className="rounded-xl bg-slate-50 border-none focus-visible:ring-0 resize-none pr-12 pl-4 py-3 text-sm"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled}
              aria-label="Gửi bình luận"
              className={cn(
                'absolute right-2 bottom-2 w-9 h-9 inline-flex items-center justify-center rounded-full transition-all',
                disabled
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary/90 active:scale-90',
              )}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </>
        ) : (
          <p className="text-xs font-medium text-slate-400 italic py-2 text-center bg-slate-50 rounded-xl">
            Bạn đang ở chế độ quản trị hệ thống — chỉ xem.
          </p>
        )}
      </div>
    </div>
  );
}
