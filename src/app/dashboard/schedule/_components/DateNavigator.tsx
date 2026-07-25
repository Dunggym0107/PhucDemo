'use client'

import React from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { endOfDay, format, addDays, isSameDay, startOfDay } from "date-fns";
import { viLocale as vi } from "@/lib/locale";

interface DateNavigatorProps {
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  weekDays: Date[];
  schedules?: any[];
}

export default function DateNavigator({ selectedDate, setSelectedDate, weekDays, schedules = [] }: DateNavigatorProps) {
  return (
    <div className="w-full">
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between pb-1 px-1 gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span className="text-sm sm:text-sm font-bold text-slate-900 whitespace-nowrap">
              Tháng {format(selectedDate, 'MM/yyyy')}
            </span>
          </div>
          <div className="flex items-center bg-slate-100/70 p-0.5 rounded-lg shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all" aria-label="Xem tuần trước" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" className="h-7 rounded-md px-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all" onClick={() => setSelectedDate(new Date())}>
              Hôm nay
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all" aria-label="Xem tuần sau" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day, idx) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const dayStart = startOfDay(day);
            const dayEnd = endOfDay(day);
            const daySchedules = schedules.filter(s => {
              return new Date(s.start_time) <= dayEnd && new Date(s.end_time) >= dayStart;
            });
            const hasPending = daySchedules.some(s => s.status === 'pending' || (s.use_vehicle && !s.vehicle_id));
            const hasApproved = daySchedules.some(s => s.status === 'approved');
            const hasRejected = daySchedules.some(s => s.status === 'rejected');
            return (
              <Button
                key={idx}
                type="button"
                variant="ghost"
                onClick={() => setSelectedDate(day)}
                aria-pressed={isSelected}
                aria-label={`Chọn ngày ${format(day, 'dd/MM/yyyy')}`}
                className={cn(
                  "relative h-auto min-h-14 flex-col items-center justify-between rounded-xl px-1 py-2 transition-all",
                  isSelected
                    ? "bg-primary text-white ring-2 ring-primary/20"
                    : "hover:bg-slate-100 text-slate-500"
                )}
              >
                <span className={cn("text-xs font-bold", isSelected ? "text-white/70" : "text-slate-500")}>
                  {format(day, 'EEEEEE', { locale: vi })}
                </span>

                <span className={cn(
                  "text-sm font-bold flex items-center justify-center w-6 h-6 rounded-full transition-all mb-1",
                  isToday
                    ? isSelected
                      ? "bg-white text-primary font-bold shadow-sm"
                      : "bg-primary/10 text-primary font-bold"
                    : ""
                )}>
                  {format(day, 'd')}
                </span>

                {(hasPending || hasApproved || hasRejected) && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                    {hasPending && (
                      <span className={cn(
                        "h-1 w-1 rounded-full shrink-0",
                        isSelected ? "bg-amber-300 ring-[0.5px] ring-white/40" : "bg-amber-400"
                      )} />
                    )}
                    {hasApproved && (
                      <span className={cn(
                        "h-1 w-1 rounded-full shrink-0",
                        isSelected ? "bg-emerald-300 ring-[0.5px] ring-white/40" : "bg-emerald-500"
                      )} />
                    )}
                    {hasRejected && (
                      <span className={cn(
                        "h-1 w-1 rounded-full shrink-0",
                        isSelected ? "bg-red-300 ring-[0.5px] ring-white/40" : "bg-red-500"
                      )} />
                    )}
                  </div>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
