'use client';

// TimePicker — chuẩn dùng chung cho mọi nơi cần chọn giờ.
//
// Pattern: dùng Select shadcn (đồng bộ Schedule module) — dropdown tự handle scroll,
// animation, accessibility; không gặp lỗi nested Popover hay block touch event.
//
// Trigger: viên thuốc bg-slate-50 + icon Clock + "HH:mm" — đồng bộ DatePicker button.
// Dropdown: shadcn SelectContent với max-h scroll mượt.

import * as React from 'react';
import { Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface TimePickerProps {
  value: string | null | undefined; // "HH:mm"
  onChange: (value: string) => void;
  minuteStep?: number; // mặc định 30 (giống Schedule). Đặt 5/15 nếu cần độ chính xác cao.
  hourStart?: number;  // mặc định 5 (đầu giờ làm việc)
  hourEnd?: number;    // mặc định 20 (cuối giờ làm việc, inclusive)
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function TimePicker({
  value,
  onChange,
  minuteStep = 30,
  hourStart = 5,
  hourEnd = 20,
  placeholder = 'Chọn giờ',
  disabled,
  triggerClassName,
}: TimePickerProps) {
  const options = React.useMemo(() => {
    const list: string[] = [];
    for (let h = hourStart; h <= hourEnd; h++) {
      for (let m = 0; m < 60; m += minuteStep) {
        list.push(`${pad(h)}:${pad(m)}`);
      }
    }
    return list;
  }, [hourStart, hourEnd, minuteStep]);

  return (
    <Select
      value={value ?? undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          'min-h-11 w-full rounded-xl bg-slate-50 border-none px-4 text-[14px] font-medium tabular-nums',
          'hover:bg-slate-100 shadow-none',
          'focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-0',
          value ? '!text-slate-900' : '!text-slate-500',
          '[&>span]:text-inherit',
          triggerClassName,
        )}
      >
        <Clock className="icon-sm text-slate-500 shrink-0" />
        <span className="flex-1 text-center">
          <SelectValue placeholder={placeholder} />
        </span>
      </SelectTrigger>
      <SelectContent
        className="rounded-xl border border-slate-200 shadow-lg max-h-[280px] min-w-[var(--radix-select-trigger-width)]"
        align="center"
      >
        {options.map((t) => (
          <SelectItem
            key={t}
            value={t}
            className="!pl-3 !pr-3 justify-center text-center rounded-lg tabular-nums font-medium cursor-pointer [&>span:first-child]:hidden"
          >
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
