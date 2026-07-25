'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TimePicker } from '@/components/ui/time-picker';
import type { ScheduleKind } from '../_lib/recurringHelpers';
import { DOW_OPTIONS } from '../_lib/recurringHelpers';

interface Props {
  kind: ScheduleKind;
  onKindChange: (v: ScheduleKind) => void;
  weeklyDow: number | null;
  onWeeklyDowChange: (v: number) => void;
  weeklyTime: string;
  onWeeklyTimeChange: (v: string) => void;
  monthlyDom: number | null;
  onMonthlyDomChange: (v: number) => void;
  monthlyTime: string;
  onMonthlyTimeChange: (v: string) => void;
}

export function CronScheduleSelector({
  kind, onKindChange,
  weeklyDow, onWeeklyDowChange, weeklyTime, onWeeklyTimeChange,
  monthlyDom, onMonthlyDomChange, monthlyTime, onMonthlyTimeChange,
}: Props) {
  return (
    <div className="group-stack">
      <Tabs value={kind} onValueChange={(v) => onKindChange(v as ScheduleKind)}>
        <TabsList className="grid grid-cols-2 min-h-11">
          <TabsTrigger value="weekly" className="rounded-lg font-semibold">Hằng tuần</TabsTrigger>
          <TabsTrigger value="monthly" className="rounded-lg font-semibold">Hằng tháng</TabsTrigger>
        </TabsList>
      </Tabs>

      {kind === 'weekly' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="tight-stack min-w-0">
            <Label className="text-label">Thứ trong tuần</Label>
            <Select
              value={weeklyDow !== null ? String(weeklyDow) : ''}
              onValueChange={(v) => onWeeklyDowChange(Number(v))}
            >
              <SelectTrigger className="w-full min-h-11 rounded-xl bg-slate-50 border-none">
                <SelectValue placeholder="Chọn thứ" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {DOW_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="tight-stack min-w-0">
            <Label className="text-label">Giờ</Label>
            <TimePicker value={weeklyTime} onChange={onWeeklyTimeChange} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="tight-stack min-w-0">
            <Label className="text-label">Ngày trong tháng</Label>
            <Select
              value={monthlyDom !== null ? String(monthlyDom) : ''}
              onValueChange={(v) => onMonthlyDomChange(Number(v))}
            >
              <SelectTrigger className="w-full min-h-11 rounded-xl bg-slate-50 border-none">
                <SelectValue placeholder="Chọn ngày" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-72">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <SelectItem key={d} value={String(d)}>Ngày {d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="tight-stack min-w-0">
            <Label className="text-label">Giờ</Label>
            <TimePicker value={monthlyTime} onChange={onMonthlyTimeChange} />
          </div>
        </div>
      )}
    </div>
  );
}
