'use client'

import React, { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { viLocale as vi } from "@/lib/locale";
import { cn } from "@/lib/utils";
import { RECOGNITION_TYPES, RecognitionType } from "../_lib/constants";

// Timeline ghi nhận + form gửi. Sender thấy nút xoá trên ghi nhận của mình.
interface RecognitionsSectionProps {
  recognitions: any[];
  viewerId: string | null;
  receiverName: string;
  canSend: boolean;
  sending: boolean;
  onSend: (params: { type: RecognitionType; content: string; receiverName: string }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export default function RecognitionsSection({
  recognitions, viewerId, receiverName, canSend, sending, onSend, onDelete,
}: RecognitionsSectionProps) {
  const [type, setType] = useState<RecognitionType>('great_work');
  const [content, setContent] = useState('');

  const submit = async () => {
    const ok = await onSend({ type, content, receiverName });
    if (ok) setContent('');
  };

  return (
    <section className="group-stack">
      <h4 className="heading-card">Ghi nhận đồng nghiệp</h4>

      {canSend && (
        <div className="rounded-2xl bg-white border border-slate-100 p-3 item-stack shadow-sm">
          <div className="flex items-center gap-2">
            <Select value={type} onValueChange={(v) => setType(v as RecognitionType)}>
              <SelectTrigger className="h-10 rounded-xl text-sm font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RECOGNITION_TYPES) as RecognitionType[]).map((k) => (
                  <SelectItem key={k} value={k} className="text-sm">
                    <span className="mr-1">{RECOGNITION_TYPES[k].emoji}</span> {RECOGNITION_TYPES[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Viết lời ghi nhận cho ${receiverName}…`}
            className="min-h-[72px] rounded-xl border-slate-200 text-sm"
            maxLength={300}
          />
          <div className="flex items-center justify-between">
            <span className="text-meta">{content.length}/300 — tối thiểu 5 ký tự</span>
            <Button
              onClick={submit}
              disabled={sending || content.trim().length < 5}
              className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold px-4 min-h-11"
            >
              <Send className="icon-sm mr-1.5" /> {sending ? "Đang gửi…" : "Gửi ghi nhận"}
            </Button>
          </div>
        </div>
      )}

      <div className="item-stack">
        {recognitions.length === 0 && (
          <div className="rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 p-4 text-center">
            <p className="text-meta">Chưa có ghi nhận nào. Hãy là người đầu tiên!</p>
          </div>
        )}
        {recognitions.map((r) => {
          const meta = RECOGNITION_TYPES[r.type as RecognitionType] ?? RECOGNITION_TYPES.great_work;
          const sender = r.sender ?? {};
          const isMine = viewerId && r.sender_id === viewerId;
          return (
            <div
              key={r.id}
              className={cn(
                "rounded-2xl bg-white border border-slate-100 p-3 flex gap-3 shadow-sm",
                r._optimistic && "opacity-60",
              )}
            >
              <Avatar className="h-9 w-9 shrink-0 ring-1 ring-slate-100">
                <AvatarImage src={sender.avatar_url} className="object-cover" />
                <AvatarFallback className="text-xs bg-primary text-white">{sender.full_name?.[0] ?? '?'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 item-stack !gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">{sender.full_name ?? 'Đồng nghiệp'}</span>
                  <span className="text-xs font-semibold text-slate-500 shrink-0">
                    {(() => { try { return format(new Date(r.created_at), "dd/MM HH:mm", { locale: vi }); } catch { return ''; } })()}
                  </span>
                </div>
                <span className="text-xs font-semibold text-amber-700 inline-flex items-center gap-1 w-fit bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                  <span>{meta.emoji}</span> {meta.label}
                </span>
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{r.content}</p>
                {isMine && !r._optimistic && (
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 w-fit mt-1 active:scale-95 transition-all"
                  >
                    <Trash2 className="h-3 w-3" /> Xoá
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
