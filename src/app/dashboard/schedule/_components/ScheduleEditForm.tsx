'use client'

import React from "react";
import { Calendar as CalendarIcon, Clock, AlertCircle, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { viLocale as vi } from "@/lib/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { timeOptions } from "../_lib/constants";
import ParticipantSelector from "./ParticipantSelector";
import ConflictWarningPopup from "./ConflictWarningPopup";

interface ScheduleEditFormProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  schedule: any;
  vehicles: any[];
  rooms: any[];
  allProfiles: any[];
  departments: any[];
  detail: any;
}

// Form chỉnh sửa lịch trình — hiển thị toàn cửa sổ Dialog
export default function ScheduleEditForm({
  isOpen, setIsOpen, schedule, vehicles, rooms, allProfiles, departments, detail
}: ScheduleEditFormProps) {
  const isResubmit = detail.editMode === 'resubmit';
  const reasonLen = (detail.changeReason || '').trim().length;
  const reasonValid = reasonLen >= 10;
  const canCoord = !!detail.canCoord;
  const [showConflictPopup, setShowConflictPopup] = React.useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent hideCloseButton className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogDescription>Chỉnh sửa thông tin lịch trình, thời gian, địa điểm và thành phần tham gia.</DialogDescription>
          <DialogTitle>Sửa lịch trình</DialogTitle>
        </DialogHeader>

        {/* Thanh tiêu đề chế độ sửa */}
        <div className="px-[var(--app-page-x)] py-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all shrink-0"
            onClick={() => detail.setIsEditingSchedule(false)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              {isResubmit ? 'Đẩy lại duyệt lịch trình' : 'Sửa lịch trình'}
            </p>
            <p className="text-label truncate">{schedule.title}</p>
          </div>
        </div>

        {/* Nội dung form sửa */}
        <ScrollArea className="app-dialog-sheet-body">
          <div className="space-y-5 p-[var(--app-page-x)]">
            {/* Lý do thay đổi — bắt buộc khi đẩy lại duyệt */}
            {isResubmit && (
              <div className="status-danger-bg border rounded-2xl p-4 item-stack">
                <Label className="text-xs font-semibold pl-0.5">Lý do thay đổi (bắt buộc)</Label>
                <Textarea
                  value={detail.changeReason || ''}
                  onChange={(e) => detail.setChangeReason(e.target.value)}
                  rows={3}
                  className="min-h-20 bg-white/70 border-none rounded-xl font-medium text-sm resize-none"
                  placeholder="Vd: Đã đổi giờ sang chiều để tránh trùng lịch BGĐ, đề nghị duyệt lại..."
                  autoFocus
                />
                <p className={cn(
                  "text-xs font-medium",
                  reasonValid ? "opacity-75" : "text-amber-700"
                )}>
                  {reasonValid
                    ? `${reasonLen} ký tự · Bộ phận điều phối sẽ nhận được lý do này khi bạn gửi.`
                    : `Cần thêm ${10 - reasonLen} ký tự (tối thiểu 10).`}
                </p>
              </div>
            )}

            {/* Tiêu đề */}
            <div className="item-stack">
              <Label className="text-xs font-medium text-slate-500 pl-0.5">Tiêu đề lịch trình</Label>
              <Input
                value={detail.editData.title || ""}
                onChange={(e) => detail.setEditData({ ...detail.editData, title: e.target.value })}
                className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"
                placeholder="VD: Họp giao ban tuần, đi công tác Hải Phòng..."
                maxLength={200}
              />
              <p className="text-xs font-medium text-slate-500 text-right tabular-nums">
                {(detail.editData.title || '').length}/200
              </p>
            </div>

            {/* Nội dung chi tiết */}
            <div className="item-stack">
              <Label className="text-xs font-medium text-slate-500 pl-0.5">Nội dung chi tiết</Label>
              <Textarea
                value={detail.editData.description || ""}
                onChange={(e) => detail.setEditData({ ...detail.editData, description: e.target.value })}
                className="min-h-20 bg-slate-50 border-none rounded-xl font-medium text-base md:text-sm resize-none"
                placeholder="Mô tả nội dung..."
              />
            </div>

            {/* Lưới 2 cột: Loại + Địa điểm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="item-stack">
                <Label className="text-xs font-medium text-slate-500 pl-0.5">Loại lịch trình</Label>
                <Select value={detail.editData.type} onValueChange={(v) => detail.setEditData((prev: any) => ({ ...prev, type: v, use_vehicle: v === 'trip' ? true : prev.use_vehicle }))}>
                  <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="trip" className="text-base md:text-sm py-3 md:py-2">Đi công tác</SelectItem>
                    <SelectItem value="event" className="text-base md:text-sm py-3 md:py-2">Sự kiện</SelectItem>
                    <SelectItem value="leave" className="text-base md:text-sm py-3 md:py-2">Nghỉ phép</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="item-stack">
                <Label className="text-xs font-medium text-slate-500 pl-0.5">Hình thức địa điểm</Label>
                <Select value={detail.editData.location === 'Chi nhánh' ? 'branch' : 'outside'} onValueChange={(v) => detail.setEditData((prev: any) => ({ ...prev, location: v === 'branch' ? 'Chi nhánh' : '', room_id: v === 'branch' ? (rooms[0]?.id || 'none') : 'none' }))}>
                  <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="outside" className="text-base md:text-sm py-3 md:py-2">Địa điểm ngoài</SelectItem>
                    <SelectItem value="branch" className="text-base md:text-sm py-3 md:py-2">Chi nhánh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lưới 4 cột: Ngày/Giờ đi - Ngày/Giờ về */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="item-stack">
                <Label className="text-xs font-medium text-slate-500 pl-0.5">Từ ngày</Label>
                <Popover open={detail.isStartOpen} onOpenChange={detail.setIsStartOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full min-h-11 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-base md:text-sm active:scale-95 transition-all">
                      <CalendarIcon className="mr-2 icon-md text-primary shrink-0" />
                      <span className="truncate">{detail.editStartDate ? format(detail.editStartDate, "dd/MM/yyyy") : "Chọn ngày"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Calendar
                      mode="single"
                      selected={detail.editStartDate}
                      onSelect={(date) => {
                        detail.setEditStartDate(date);
                        if (date && detail.editEndDate && date > detail.editEndDate) detail.setEditEndDate(date);
                        detail.setIsStartOpen(false);
                      }}
                      initialFocus
                      locale={vi}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="item-stack">
                <Label className="text-xs font-medium text-slate-500 pl-0.5">Giờ đi</Label>
                <Select value={detail.editStartTime} onValueChange={detail.handleStartTimeChange}>
                  <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm">
                    <Clock className="mr-2 icon-md text-primary shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time} className="text-base md:text-sm py-3 md:py-2">{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="item-stack">
                <Label className="text-xs font-medium text-slate-500 pl-0.5">Đến ngày</Label>
                <Popover open={detail.isEndOpen} onOpenChange={detail.setIsEndOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className={cn("w-full min-h-11 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-base md:text-sm active:scale-95 transition-all", !detail.editEndDate && "text-slate-500")}>
                      <CalendarIcon className="mr-2 icon-md shrink-0" />
                      <span className="truncate">{detail.editEndDate ? format(detail.editEndDate, "dd/MM/yyyy") : "Tự động"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Calendar
                      mode="single"
                      selected={detail.editEndDate}
                      onSelect={(date) => {
                        detail.setEditEndDate(date);
                        detail.setIsEndOpen(false);
                      }}
                      initialFocus
                      locale={vi}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="item-stack">
                <Label className="text-xs font-medium text-slate-500 pl-0.5">Giờ về</Label>
                <Select value={detail.editEndTime || "none"} onValueChange={(v) => detail.setEditEndTime(v === "none" ? "" : v)}>
                  <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm">
                    <Clock className="mr-2 icon-md shrink-0 text-slate-500" />
                    <SelectValue placeholder="Tự động" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="none" className="text-base md:text-sm py-3 md:py-2 italic">Tự động</SelectItem>
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time} className="text-base md:text-sm py-3 md:py-2">{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>



            {/* Địa điểm chi tiết */}
            {detail.editData.type !== 'leave' && detail.editData.location === 'Chi nhánh' ? (
              <div className="item-stack">
                <Label className="text-xs font-medium text-slate-500 pl-0.5">Phòng họp</Label>
                <Select value={detail.editData.room_id || 'none'} onValueChange={(v) => detail.setEditData((prev: any) => ({ ...prev, room_id: v }))}>
                  <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"><SelectValue placeholder="Chọn phòng họp" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {rooms.map(r => <SelectItem key={r.id} value={r.id} className="text-base md:text-sm py-3 md:py-2">{r.name} ({r.capacity} chỗ)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : detail.editData.type !== 'leave' ? (
              <div className="item-stack animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <Label className="text-label pl-0.5">Lộ trình di chuyển</Label>
                  <div 
                    role="button"
                    onClick={() => {
                      detail.setEditData((prev: any) => {
                        const current = prev.destinations || [{ location: '' }];
                        return { ...prev, destinations: [...current, { location: '' }] };
                      });
                    }}
                    className="flex items-center h-7 text-xs font-medium text-primary hover:opacity-80 px-2 rounded-md cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Thêm điểm đến
                  </div>
                </div>
                {(detail.editData.destinations || [{ location: '' }]).map((dest: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 relative">
                    <div className="relative flex-1">
                      <Input
                        placeholder={`VD: 108 Trần Hưng Đạo, Bắc Ninh...`}
                        className="h-11 bg-slate-50 border-none rounded-xl font-medium px-4 shadow-sm text-sm"
                        value={dest.location}
                        onChange={(e) => {
                          const newDests = [...(detail.editData.destinations || [{ location: '' }])];
                          newDests[idx].location = e.target.value;
                          detail.setEditData({ ...detail.editData, destinations: newDests });
                        }}
                      />
                    </div>
                    {(detail.editData.destinations?.length > 1) && (
                      <button
                        type="button"
                        onClick={() => {
                          const newDests = [...detail.editData.destinations];
                          newDests.splice(idx, 1);
                          detail.setEditData({ ...detail.editData, destinations: newDests });
                        }}
                        className="shrink-0 text-slate-500 hover:text-red-500 hover:bg-transparent transition-colors p-2 text-xl leading-none"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Phương tiện */}
            {detail.editData.type !== 'leave' && (
              <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm mt-4">
                <Switch
                  checked={!!detail.editData.use_vehicle}
                  onCheckedChange={(checked) => detail.setEditData({ ...detail.editData, use_vehicle: checked, vehicle_id: checked ? 'none' : detail.editData.vehicle_id })}
                  aria-label="Bật hoặc tắt sử dụng xe cơ quan"
                />
                <div className="flex flex-col flex-1 min-w-[120px]">
                  <span className="text-sm font-medium text-slate-900 whitespace-nowrap">Sử dụng xe cơ quan</span>
                </div>
                {canCoord && detail.editData.use_vehicle && (
                  <div className="w-full sm:w-64 shrink-0 animate-in fade-in zoom-in-95">
                    <Select value={detail.editData.vehicle_id || 'none'} onValueChange={(v) => detail.setEditData({ ...detail.editData, vehicle_id: v })}>
                      <SelectTrigger className="h-9 bg-slate-50 border-none rounded-lg font-medium text-xs shadow-sm"><SelectValue placeholder="Chọn xe" /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="none" className="text-xs py-2">Chưa chọn xe</SelectItem>
                        {vehicles.map(v => (
                          <SelectItem key={v.id} value={v.id} className="text-xs py-2">
                            {v.name} - {v.plate_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Thành phần tham gia */}
            {detail.editData.type !== 'leave' && (
              <ParticipantSelector
                allProfiles={allProfiles}
                departments={departments}
                bgdMode={detail.bgdMode} setBgdMode={detail.setBgdMode}
                selectedBGD={detail.selectedBGD} setSelectedBGD={detail.setSelectedBGD}
                deptMode={detail.deptMode} setDeptMode={detail.setDeptMode}
                filterDepts={detail.filterDepts} setFilterDepts={detail.setFilterDepts}
                participantMode={detail.participantMode} setParticipantMode={detail.setParticipantMode}
                selectedParticipants={detail.selectedParticipants} setSelectedParticipants={detail.setSelectedParticipants}
              />
            )}

            {/* Cảnh báo xung đột */}
            {detail.editData.type !== 'leave' && detail.conflicts.length > 0 && (
              <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 space-y-2 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-sm font-bold text-red-700 whitespace-nowrap">Cảnh báo trùng lịch</span>
                </div>
                <ul className="list-disc pl-5 text-xs font-medium text-red-600/80 space-y-1">
                  {detail.conflicts.map((c: string, i: number) => (
                    <li key={i} className="leading-relaxed">{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          </ScrollArea>

          {/* Footer chế độ sửa */}
          <div className="app-dialog-sheet-footer flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="min-h-11 px-4 rounded-xl font-medium text-slate-500 text-sm hover:bg-slate-200 active:scale-95 transition-all whitespace-nowrap"
              onClick={() => detail.setIsEditingSchedule(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              className={cn(
                "min-h-11 px-4 rounded-xl font-medium text-sm shadow-lg active:scale-95 transition-all whitespace-nowrap",
                detail.editData.type !== 'leave' && detail.conflicts.length > 0
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                  : isResubmit
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-red-600/20"
                    : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
              )}
              onClick={() => {
                if (detail.editData.type !== 'leave' && detail.conflicts.length > 0) {
                  setShowConflictPopup(true);
                } else {
                  detail.handleSaveSchedule();
                }
              }}
              disabled={isResubmit && !reasonValid}
            >
              {isResubmit
                ? 'Gửi lại để duyệt'
                : (detail.editData.type !== 'leave' && detail.conflicts.length > 0 ? 'Vẫn tiếp tục lưu?' : 'Lưu lịch trình')}
            </Button>
          </div>

        <ConflictWarningPopup
          isOpen={showConflictPopup}
          onClose={() => setShowConflictPopup(false)}
          onConfirm={() => {
            setShowConflictPopup(false);
            detail.handleSaveSchedule();
          }}
          conflicts={detail.conflicts || []}
        />
      </DialogContent>
    </Dialog>
  );
}
