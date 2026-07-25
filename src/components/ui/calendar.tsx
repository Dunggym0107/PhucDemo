"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
 className,
 classNames,
 showOutsideDays = true,
 ...props
}: CalendarProps) {
 return (
 <DayPicker
 showOutsideDays={showOutsideDays}
 className={cn("p-4", className)}
 classNames={{
 months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
 month: "group-stack",
 month_caption: "flex justify-center relative items-center min-h-11 mb-4 z-20",
 caption_label: "text-sm font-semibold text-slate-800",
 dropdowns: "flex items-center justify-center gap-2 relative z-30",
 dropdown: "min-h-10 appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-emerald-500",
 dropdown_root: "relative flex items-center",
 nav: "flex items-center justify-between absolute w-full left-0 px-2 pointer-events-none z-30",
 button_previous: cn(
 buttonVariants({ variant: "ghost" }),
 "h-11 w-11 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-slate-100 rounded-xl transition-all pointer-events-auto relative z-30"
 ),
 button_next: cn(
 buttonVariants({ variant: "ghost" }),
 "h-11 w-11 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-slate-100 rounded-xl transition-all pointer-events-auto relative z-30"
 ),
 month_grid: "w-full border-collapse block",
 weekdays: "grid grid-cols-7 w-full mb-3",
 weekday: "text-slate-500 font-semibold text-xs text-center flex items-center justify-center",
 week: "grid grid-cols-7 w-full mt-1.5",
 day: "p-0 relative flex items-center justify-center h-11 w-11",
 day_button: cn(
 buttonVariants({ variant: "ghost" }),
 "h-11 w-11 p-0 font-medium rounded-full transition-colors cursor-pointer hover:bg-slate-200 hover:text-slate-900 relative"
 ),
 selected: "bg-emerald-500 !text-white hover:bg-slate-200 hover:!text-slate-900 focus:bg-emerald-500 focus:!text-white rounded-full",
 today: "bg-blue-500 !text-white rounded-full",
 outside: "text-slate-500 opacity-40",
 disabled: "text-slate-200 opacity-20",
 hidden: "invisible",
 ...classNames,
 }}
 components={{
 Chevron: ({ orientation }) => {
 if (orientation === "left") return <ChevronLeft className="icon-md" />;
 return <ChevronRight className="icon-md" />;
 }
 }}
 formatters={{
 formatWeekdayName: (date) => {
 const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
 return days[date.getDay()];
 }
 }}
 {...props}
 />
 )
}
Calendar.displayName = "Calendar"

export { Calendar }
