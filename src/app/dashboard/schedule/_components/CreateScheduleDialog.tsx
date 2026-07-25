'use client'

import React from "react";
import {
  Calendar as CalendarIcon,
  MapPin,
  Car,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";

import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, sortProfilesByHierarchy } from "@/lib/utils";
import { format } from "date-fns";
import { viLocale as vi } from "@/lib/locale";
import { notifyValidation } from "@/lib/notify";
import ParticipantSelector from "./ParticipantSelector";
import ConflictWarningPopup from "./ConflictWarningPopup";
import { HOUR_END } from "../_lib/constants";

interface CreateScheduleDialogProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  newSchedule: any;
  setNewSchedule: (v: any) => void;
  startDate: Date | undefined;
  setStartDate: (v: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (v: Date | undefined) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  isStartOpen: boolean;
  setIsStartOpen: (v: boolean) => void;
  isEndOpen: boolean;
  setIsEndOpen: (v: boolean) => void;
  rooms: any[];

  conflicts: string[];
  onSubmit: () => void;
  toast: any;
  allProfiles: any[];
  departments: any[];
  bgdMode: 'all' | 'specific' | 'none';
  setBgdMode: (v: 'all' | 'specific' | 'none') => void;
  selectedBGD: string[];
  setSelectedBGD: (v: string[]) => void;
  deptMode: 'all' | 'specific' | 'none';
  setDeptMode: (v: 'all' | 'specific' | 'none') => void;
  filterDepts: string[];
  setFilterDepts: (v: string[]) => void;
  participantMode: 'all' | 'manager' | 'staff';
  setParticipantMode: (v: 'all' | 'manager' | 'staff') => void;
  selectedParticipants: string[];
  setSelectedParticipants: (v: string[]) => void;
  profile?: any;
}

export default function CreateScheduleDialog(props: CreateScheduleDialogProps) {
  const {
    isOpen, setIsOpen,
    newSchedule, setNewSchedule,
    startDate, setStartDate, endDate, setEndDate,
    startTime, setStartTime, endTime, setEndTime,
    isStartOpen, setIsStartOpen, isEndOpen, setIsEndOpen,
    rooms, conflicts, onSubmit, toast,
    allProfiles, departments,
    bgdMode, setBgdMode, selectedBGD, setSelectedBGD,
    deptMode, setDeptMode, filterDepts, setFilterDepts,
    participantMode, setParticipantMode,
    selectedParticipants, setSelectedParticipants,
    profile,
  } = props;

  const isLeave = newSchedule.type === 'leave';
  const showEmployeeSelector = isLeave && ['hr_officer', 'secretary', 'admin'].includes(profile?.role);
  const [showConflictPopup, setShowConflictPopup] = React.useState(false);
  const sortedProfiles = React.useMemo(() => {
    const sorted = [...allProfiles];
    return sortProfilesByHierarchy(sorted);
  }, [allProfiles]);

  const leaveOnBehalfProfiles = React.useMemo(() => {
    return sortedProfiles.filter((p: any) => {
      // Cho phép đăng ký nghỉ cho BGĐ
      if (p.role === 'director') return true;
      // Và cũng cho phép tự chọn chính mình (HR, Thư ký, Admin) để đăng ký nghỉ phép cá nhân
      if (p.id === profile?.id) return true;
      return false;
    });
  }, [sortedProfiles, profile?.id]);

  const scheduleTypes = [
    { value: 'trip', label: 'Công tác' },
    { value: 'event', label: 'Sự kiện' },
    { value: 'leave', label: 'Nghỉ phép' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 px-5 font-medium h-11 active:scale-[0.98] transition-all duration-300 ease-in-out">
          <Plus className="w-5 h-5 mr-2" /> Đăng ký lịch mới
        </Button>
      </DialogTrigger>
      <DialogContent
        className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl"
      >
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-lg font-semibold text-slate-900">Thiết lập lịch trình mới</DialogTitle>
          <DialogDescription className="sr-only">Thiết lập chi tiết thời gian và thành phần tham gia cho lịch trình mới</DialogDescription>
        </DialogHeader>
        <div className="app-dialog-sheet-body">
        <div className="space-y-5 px-[var(--app-page-x)] py-4">

          {/* 1. Thời gian */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-label whitespace-nowrap">Từ ngày</Label>
              <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-11 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-sm active:scale-[0.98] transition-all duration-300 ease-in-out truncate">
                    <CalendarIcon className="mr-2 icon-md text-primary shrink-0" />
                    <span className="truncate">{startDate ? format(startDate, "dd/MM/yyyy") : "Chọn ngày"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      if (date && endDate && date > endDate) setEndDate(date);
                      setIsStartOpen(false);
                    }}
                    initialFocus
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-label whitespace-nowrap">{isLeave ? 'Giờ bắt đầu' : 'Giờ đi'}</Label>
              <TimePicker
                value={startTime}
                onChange={(v) => {
                  setStartTime(v);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-label whitespace-nowrap">Đến ngày</Label>
              <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-11 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-sm active:scale-[0.98] transition-all duration-300 ease-in-out truncate", !endDate && "text-slate-500")}>
                    <CalendarIcon className="mr-2 icon-md shrink-0" />
                    <span className="truncate">{endDate ? format(endDate, "dd/MM/yyyy") : "Tự động"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      setEndDate(date);
                      setIsEndOpen(false);
                    }}
                    initialFocus
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-label whitespace-nowrap">{isLeave ? 'Giờ kết thúc' : 'Giờ về'}</Label>
              <TimePicker
                value={endTime || null}
                onChange={(v) => setEndTime(v)}
                placeholder="Tự động"
              />
            </div>
          </div>



          {/* 2. Loại hình & Tiêu đề */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-label whitespace-nowrap">Loại hình</Label>
              <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-50 p-1.5">
                {scheduleTypes.map((type) => {
                  const isSelected = newSchedule.type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNewSchedule((prev: any) => ({ ...prev, type: type.value, use_vehicle: type.value === 'trip' }))}
                      className={cn(
                        "min-h-10 rounded-xl px-2 text-xs font-semibold transition-all active:scale-[0.98] sm:text-xs",
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                          : "bg-white text-slate-500 ring-1 ring-slate-100 hover:bg-slate-100 hover:text-slate-700"
                      )}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-label whitespace-nowrap">
                {isLeave ? 'Lý do' : 'Tiêu đề'}
              </Label>
              <Input
                placeholder={isLeave ? "Lý do nghỉ phép..." : "VD: Họp giao ban tuần, đi công tác Hải Phòng..."}
                className="h-11 scroll-mt-24 bg-slate-50 border-none rounded-xl font-medium text-sm"
                maxLength={200}
                value={newSchedule.title}
                onChange={(e) => setNewSchedule({ ...newSchedule, title: e.target.value })}
              />
              <p className="text-xs font-medium text-slate-500 text-right tabular-nums">
                {(newSchedule.title || '').length}/200
              </p>
            </div>
          </div>

          {/* Chọn nhân sự nghỉ phép (chỉ dành cho HR Officer / Thư ký / Admin khi đăng ký Nghỉ phép) */}
          {showEmployeeSelector && (
            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
              <Label className="text-label">Nhân sự nghỉ phép</Label>
              <Select
                value={newSchedule.target_profile_id || profile?.id || ""}
                onValueChange={(val) => setNewSchedule({ ...newSchedule, target_profile_id: val })}
              >
                <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-medium text-sm">
                  <SelectValue placeholder="Chọn nhân sự..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-lg">
                  {leaveOnBehalfProfiles.map((p: any) => {
                    const isSelf = p.id === profile?.id;
                    if (isSelf) {
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} (Tôi)
                        </SelectItem>
                      );
                    }
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 3. Địa điểm & Phương tiện — ẩn khi là nghỉ phép */}
          {!isLeave && (
            <ParticipantSelector
              allProfiles={allProfiles}
              departments={departments}
              bgdMode={bgdMode}
              setBgdMode={setBgdMode}
              selectedBGD={selectedBGD}
              setSelectedBGD={setSelectedBGD}
              deptMode={deptMode}
              setDeptMode={setDeptMode}
              filterDepts={filterDepts}
              setFilterDepts={setFilterDepts}
              participantMode={participantMode}
              setParticipantMode={setParticipantMode}
              selectedParticipants={selectedParticipants}
              setSelectedParticipants={setSelectedParticipants}
            />
          )}

          {!isLeave && (
            <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <Label className="text-label whitespace-nowrap">Địa điểm & Phương tiện</Label>
                <Tabs
                  value={newSchedule.location === 'Chi nhánh' ? 'branch' : 'outside'}
                  onValueChange={(value) => {
                    if (value === 'branch') setNewSchedule((prev: any) => ({ ...prev, location: 'Chi nhánh', room_id: prev.room_id || rooms[0]?.id || 'none' }));
                    else setNewSchedule((prev: any) => ({ ...prev, room_id: 'none', location: '' }));
                  }}
                  className="w-full sm:w-auto"
                >
                  <TabsList className="grid min-w-[180px] grid-cols-2 bg-white shadow-sm ring-1 ring-slate-100 min-h-9">
                    <TabsTrigger value="outside" className="rounded-md text-sm font-medium">Ngoài</TabsTrigger>
                    <TabsTrigger value="branch" className="rounded-md text-sm font-medium">Chi nhánh</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {newSchedule.location === 'Chi nhánh' ? (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                  <Label className="text-xs md:text-label whitespace-nowrap">Chọn phòng họp</Label>
                  <Select value={newSchedule.room_id} onValueChange={(v) => setNewSchedule((prev: any) => ({ ...prev, room_id: v }))}>
                    <SelectTrigger className="h-11 bg-white border-none rounded-xl font-medium shadow-sm text-sm">
                      <SelectValue placeholder="Chọn phòng họp..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-lg">
                      {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.capacity} chỗ)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="item-stack animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs md:text-label whitespace-nowrap">Lộ trình di chuyển</Label>
                    <div 
                      role="button"
                      onClick={() => {
                        setNewSchedule((prev: any) => {
                          const current = prev.destinations || [{ location: '' }];
                          return { ...prev, destinations: [...current, { location: '' }] };
                        });
                      }}
                      className="flex items-center h-7 text-xs font-medium text-primary hover:opacity-80 px-2 rounded-md cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Thêm điểm đến
                    </div>
                  </div>
                  {(newSchedule.destinations || [{ location: '' }]).map((dest: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 relative">
                      <div className="relative flex-1">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          placeholder={`VD: 108 Trần Hưng Đạo, Bắc Ninh...`}
                          className="h-11 bg-white border-none rounded-xl font-medium pl-11 pr-10 shadow-sm text-sm"
                          value={dest.location}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewSchedule((prev: any) => {
                              const newDests = [...(prev.destinations || [{ location: '' }])];
                              newDests[idx] = { location: val };
                              return { ...prev, destinations: newDests };
                            });
                          }}
                        />
                      </div>
                      {(newSchedule.destinations?.length > 1) && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewSchedule((prev: any) => {
                              const newDests = [...(prev.destinations || [])];
                              newDests.splice(idx, 1);
                              return { ...prev, destinations: newDests };
                            });
                          }}
                          className="shrink-0 text-slate-500 hover:text-red-500 hover:bg-transparent transition-colors p-2 text-xl leading-none"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Switch
                  checked={newSchedule.use_vehicle}
                  onCheckedChange={(checked) => setNewSchedule((prev: any) => ({
                    ...prev,
                    use_vehicle: checked,
                    vehicle_id: 'none',
                    requested_vehicle_type: null,
                  }))}
                  aria-label="Bật hoặc tắt sử dụng xe cơ quan"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-900 whitespace-nowrap">Sử dụng xe cơ quan</span>
                  <span className="text-xs font-medium text-slate-500">Bộ phận điều phối sẽ gán xe và lái xe, sau đó lịch tự được xác nhận.</span>
                </div>
              </div>
            </div>
          )}



          {/* 4. Thành phần tham gia — ẩn khi là nghỉ phép */}
          {/* Cảnh báo trùng lịch — chỉ hiển thị khi không phải nghỉ phép */}
          {!isLeave && conflicts.length > 0 && (
            <div className="p-3 bg-red-50/50 rounded-2xl border border-red-100 mt-4 space-y-2 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">Cảnh báo trùng lịch</span>
              </div>
              <ul className="list-disc pl-5 text-xs font-medium text-red-600/80 space-y-1">
                {conflicts.map((c, i) => (
                  <li key={i} className="leading-relaxed">{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        </div>
        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2 sm:gap-3">
          <Button
            onClick={() => {
              if (!isLeave && conflicts.length > 0) {
                setShowConflictPopup(true);
              } else {
                onSubmit();
              }
            }}
            className={cn(
              "w-full h-11 rounded-xl font-semibold active:scale-[0.98] transition-all duration-300 ease-in-out",
              !isLeave && conflicts.length > 0
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "bg-primary hover:bg-primary/90 text-white"
            )}
          >
            {isLeave ? 'Gửi đơn nghỉ phép' : (!isLeave && conflicts.length > 0 ? 'Vẫn tiếp tục đặt lịch?' : 'Xác nhận đăng ký')}
          </Button>
        </DialogFooter>

        <ConflictWarningPopup
          isOpen={showConflictPopup}
          onClose={() => setShowConflictPopup(false)}
          onConfirm={() => {
            setShowConflictPopup(false);
            onSubmit();
          }}
          conflicts={conflicts}
        />
      </DialogContent>
    </Dialog>
  );
}
