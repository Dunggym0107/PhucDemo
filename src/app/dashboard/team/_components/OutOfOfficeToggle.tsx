'use client'

import React, { useMemo, useState } from "react";
import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/utils/supabase/client";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { format } from "date-fns";
import { viLocale as vi } from "@/lib/locale";

// Toggle Out-of-Office cho chính chủ. 1 user — 1 record active (UNIQUE).
// Optimistic: caller pass refetch để reload sau khi save thành công.
interface OutOfOfficeToggleProps {
  userId: string;
  currentOoo: any | null;
  onChange?: () => void;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OutOfOfficeToggle({ userId, currentOoo, onChange }: OutOfOfficeToggleProps) {
  const supabase = useMemo(() => createClient(), []);
  const [enabled, setEnabled] = useState(!!currentOoo);
  const [message, setMessage] = useState<string>(currentOoo?.message ?? '');
  const defaultEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalInput(d);
  }, []);
  const [endsAt, setEndsAt] = useState<string>(
    currentOoo?.ends_at ? toLocalInput(new Date(currentOoo.ends_at)) : defaultEnd,
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!enabled) {
      // Tắt — xoá record
      setSaving(true);
      try {
        const { error } = await supabase.from('out_of_office').delete().eq('user_id', userId);
        if (error) throw error;
        notifySuccess("Đã tắt thông điệp vắng mặt");
        onChange?.();
      } catch (error) {
        notifyError(error, "Không tắt được vắng mặt");
      } finally {
        setSaving(false);
      }
      return;
    }

    const trimmed = message.trim();
    if (trimmed.length < 5) { notifyValidation("Thông điệp tối thiểu 5 ký tự"); return; }
    const endDate = new Date(endsAt);
    if (isNaN(endDate.getTime()) || endDate < new Date()) { notifyValidation("Thời gian kết thúc phải sau hiện tại"); return; }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('out_of_office')
        .upsert({ user_id: userId, message: trimmed, ends_at: endDate.toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      notifySuccess("Đã bật thông điệp vắng mặt");
      onChange?.();
    } catch (error) {
      notifyError(error, "Không lưu được vắng mặt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white border border-slate-100 p-4 item-stack shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shrink-0">
            <Power className="icon-sm" />
          </span>
          <div className="min-w-0">
            <h4 className="heading-card">Vắng mặt (OOO)</h4>
            <p className="text-meta">Hiện banner trên hồ sơ của bạn cho đến khi hết hạn</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="VD: Đi học CDIO, liên hệ chị Mai 1234…"
            className="min-h-[64px] rounded-xl text-sm"
            maxLength={200}
          />
          <div className="item-stack !gap-1">
            <p className="text-label">Hết hạn lúc</p>
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="h-10 rounded-xl text-sm"
            />
            {currentOoo?.ends_at && (
              <span className="text-meta">
                Hiện tại: {format(new Date(currentOoo.ends_at), "EEEE, dd/MM/yyyy HH:mm", { locale: vi })}
              </span>
            )}
          </div>
        </>
      )}

      <Button
        onClick={save}
        disabled={saving}
        className="h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold min-h-11"
      >
        {saving ? "Đang lưu…" : enabled ? "Lưu thông điệp" : "Tắt vắng mặt"}
      </Button>
    </section>
  );
}
