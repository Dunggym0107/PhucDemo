'use client'

import React, { useState, useEffect } from "react";
import { Clock, MapPin, Car, DoorOpen, ChevronRight, ArrowRight, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format, isAfter } from "date-fns";

interface ResourcesManagerDashboardProps {
  schedules: any[];
  vehicles: any[];
  rooms: any[];
  selectedDate: Date;
  onSelectSchedule: (s: any) => void;
}

export default function ResourcesManagerDashboard({ schedules, vehicles, rooms, selectedDate, onSelectSchedule }: ResourcesManagerDashboardProps) {
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Lấy tất cả lịch sắp tới cho một xe/phòng (sau thời điểm hiện tại, sắp xếp theo giờ)
  const getUpcomingTrips = (vehicleId: string) =>
    schedules
      .filter(s =>
        s.vehicle_id === vehicleId &&
        (s.status === 'approved' || s.status === 'in_progress') &&
        (s.status === 'in_progress' || isAfter(new Date(s.end_time), now))
      )
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const getUpcomingMeetings = (roomId: string) =>
    schedules
      .filter(s =>
        s.room_id === roomId &&
        (s.status === 'approved') &&
        isAfter(new Date(s.end_time), now)
      )
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const fmtTime = (d: Date) => format(d, 'HH:mm');
  const fmtDateShort = (d: Date) => format(d, 'dd/MM');
  const fmtDateTime = (d: Date) => format(d, 'dd/MM HH:mm');

  return (
    <div className="section-stack motion-safe:animate-fade-in-up">
      {/* Giám sát tài nguyên */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Đội xe */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-slate-500 flex items-center gap-2">
            <Car className="w-3.5 h-3.5 text-slate-900 shrink-0" />
            <span>Giám sát Đội xe</span>
          </h3>
          <div className="item-stack">
            {vehicles.map(v => {
              const upcomingTrips = getUpcomingTrips(v.id);
              const currentTrip = upcomingTrips.find(s => new Date(s.start_time) <= now);
              const nextTrip = upcomingTrips.find(s => isAfter(new Date(s.start_time), now));
              const isBusy = !!currentTrip && currentTrip.status === 'approved' && new Date(currentTrip.start_time) <= now;
              const isInProgress = !!currentTrip && currentTrip.status === 'in_progress';
              const isExpanded = expandedVehicle === v.id;
              const clickTarget = currentTrip || nextTrip;

              return (
                <div
                  key={v.id}
                  className={cn(
                    "premium-card border border-slate-200 bg-white transition-all duration-200 overflow-hidden p-0",
                    clickTarget ? "cursor-pointer hover:shadow-md hover:border-slate-200" : "border-slate-100",
                    isExpanded && "border-slate-200 shadow-md"
                  )}
                >
                  {/* Header row */}
                  <div
                    className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5"
                    onClick={() => clickTarget && setExpandedVehicle(isExpanded ? null : v.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "p-2.5 rounded-xl shrink-0 transition-colors",
                        isBusy ? "bg-red-50 text-red-700" : isInProgress ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"
                      )}>
                        <Car className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{v.name}</p>
                        <p className="text-xs font-medium text-slate-500 truncate tabular-nums">{v.plate_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={cn(
                        "rounded-full font-semibold text-xs px-2 py-1 whitespace-nowrap",
                        isInProgress ? "bg-slate-900 text-white" :
                        isBusy ? "bg-red-600 text-white" :
                        nextTrip ? "bg-amber-50 text-amber-700 border border-amber-100" :
                        "bg-slate-100 text-slate-700"
                      )}>
                        {isInProgress ? "Đang chạy" : isBusy ? "Quá giờ" : nextTrip ? "Sắp đi" : "Rảnh"}
                      </Badge>
                      {clickTarget && (
                        <ChevronRight className={cn(
                          "w-4 h-4 text-slate-500 transition-transform duration-200",
                          isExpanded && "rotate-90"
                        )} />
                      )}
                    </div>
                  </div>

                  {/* Current trip inline preview */}
                  {(isBusy || isInProgress) && currentTrip && (
                    <div className="px-5 sm:px-6 pb-3 sm:pb-4 -mt-1">
                      <div className={cn(
                        "rounded-xl px-3.5 py-3 flex items-center justify-between gap-3 border",
                        isBusy ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
                      )}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={currentTrip.creator?.avatar_url} />
                            <AvatarFallback className="text-xs font-semibold">{currentTrip.creator?.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold text-slate-900 truncate">{currentTrip.title}</span>
                        </div>
                        <span className={cn(
                          "text-xs font-semibold whitespace-nowrap tabular-nums",
                          isBusy ? "text-red-700" : "text-amber-700"
                        )}>
                          {fmtTime(new Date(currentTrip.start_time))} – {fmtTime(new Date(currentTrip.end_time))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Next trip teaser (when idle) */}
                  {!isBusy && !isInProgress && nextTrip && !isExpanded && (
                    <div className="px-5 sm:px-6 pb-3 sm:pb-4 -mt-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <ArrowRight className="w-3 h-3 shrink-0" />
                        <span className="truncate">Kế tiếp: <span className="font-semibold text-slate-600">{nextTrip.title}</span> lúc <span className="font-semibold text-slate-700 tabular-nums">{fmtDateTime(new Date(nextTrip.start_time))}</span></span>
                      </div>
                    </div>
                  )}

                  {/* Expanded: all upcoming trips */}
                  {isExpanded && clickTarget && (
                    <div className="border-t border-slate-100 px-5 sm:px-6 py-4 sm:py-5 item-stack bg-slate-50/50">
                      <p className="text-xs font-semibold text-slate-600">Lịch trình sắp tới</p>
                      {upcomingTrips.length === 0 ? (
                        <p className="text-xs text-slate-500">Không có lịch trình nào.</p>
                      ) : (
                        upcomingTrips.slice(0, 5).map((trip, idx) => {
                          const isNow = new Date(trip.start_time) <= now;
                          return (
                            <div
                              key={trip.id}
                              className={cn(
                                "flex items-start gap-3 rounded-xl px-3.5 py-3 cursor-pointer transition-colors",
                                isNow ? "bg-amber-50 hover:bg-amber-100 border border-amber-100" : "bg-white hover:bg-slate-50 border border-slate-100"
                              )}
                              onClick={(e) => { e.stopPropagation(); onSelectSchedule(trip); }}
                            >
                              <div className={cn(
                                "mt-0.5 w-1.5 h-1.5 rounded-full shrink-0",
                                isNow ? "bg-amber-600" : "bg-slate-300"
                              )} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-800 truncate">{trip.title}</p>
                                {trip.location && (
                                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                                    <span className="truncate">{trip.location}</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                                  {fmtTime(new Date(trip.start_time))} – {fmtTime(new Date(trip.end_time))}
                                </p>
                                <p className="text-xs text-slate-500 tabular-nums">{fmtDateShort(new Date(trip.start_time))}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phòng họp */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-slate-500 flex items-center gap-2">
            <DoorOpen className="w-3.5 h-3.5 text-slate-900 shrink-0" />
            <span>Tình trạng Phòng họp</span>
          </h3>
          <div className="item-stack">
            {rooms.map(r => {
              const upcomingMeetings = getUpcomingMeetings(r.id);
              const currentMeeting = upcomingMeetings.find(s => new Date(s.start_time) <= now);
              const nextMeeting = upcomingMeetings.find(s => isAfter(new Date(s.start_time), now));
              const isBusy = !!currentMeeting;
              const isExpanded = expandedRoom === r.id;
              const clickTarget = currentMeeting || nextMeeting;

              return (
                <div
                  key={r.id}
                  className={cn(
                    "premium-card border border-slate-200 bg-white transition-all duration-200 overflow-hidden p-0",
                    clickTarget ? "cursor-pointer hover:shadow-md hover:border-slate-200" : "border-slate-100",
                    isExpanded && "border-slate-200 shadow-md"
                  )}
                >
                  {/* Header row */}
                  <div
                    className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5"
                    onClick={() => clickTarget && setExpandedRoom(isExpanded ? null : r.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "p-2.5 rounded-xl shrink-0",
                        isBusy ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"
                      )}>
                        <DoorOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{r.name}</p>
                        <p className="text-xs font-medium text-slate-500 truncate">{r.capacity} chỗ • {r.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={cn(
                        "rounded-full font-semibold text-xs px-2 py-1 whitespace-nowrap",
                        isBusy ? "bg-slate-900 text-white" :
                        nextMeeting ? "bg-amber-50 text-amber-700 border border-amber-100" :
                        "bg-slate-100 text-slate-700"
                      )}>
                        {isBusy ? "Đang họp" : nextMeeting ? "Sắp họp" : "Trống"}
                      </Badge>
                      {clickTarget && (
                        <ChevronRight className={cn(
                          "w-4 h-4 text-slate-500 transition-transform duration-200",
                          isExpanded && "rotate-90"
                        )} />
                      )}
                    </div>
                  </div>

                  {/* Current meeting inline */}
                  {isBusy && currentMeeting && (
                    <div className="px-5 sm:px-6 pb-3 sm:pb-4 -mt-1">
                      <div className="bg-slate-50 rounded-xl px-3.5 py-3 flex items-center justify-between gap-3 border border-slate-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={currentMeeting.creator?.avatar_url} />
                            <AvatarFallback className="text-xs font-semibold">{currentMeeting.creator?.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold text-slate-900 truncate">{currentMeeting.title}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 whitespace-nowrap tabular-nums">
                          {fmtTime(new Date(currentMeeting.start_time))} – {fmtTime(new Date(currentMeeting.end_time))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Next meeting teaser (when idle) */}
                  {!isBusy && nextMeeting && !isExpanded && (
                    <div className="px-5 sm:px-6 pb-3 sm:pb-4 -mt-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <ArrowRight className="w-3 h-3 shrink-0" />
                        <span className="truncate">Kế tiếp: <span className="font-semibold text-slate-600">{nextMeeting.title}</span> lúc <span className="font-semibold text-slate-700 tabular-nums">{fmtDateTime(new Date(nextMeeting.start_time))}</span></span>
                      </div>
                    </div>
                  )}

                  {/* Expanded: upcoming meetings list */}
                  {isExpanded && clickTarget && (
                    <div className="border-t border-slate-100 px-5 sm:px-6 py-4 sm:py-5 item-stack bg-slate-50/50">
                      <p className="text-xs font-semibold text-slate-600">Lịch họp sắp tới</p>
                      {upcomingMeetings.length === 0 ? (
                        <p className="text-xs text-slate-500">Không có lịch họp nào.</p>
                      ) : (
                        upcomingMeetings.slice(0, 5).map((meeting) => {
                          const isNow = new Date(meeting.start_time) <= now;
                          return (
                            <div
                              key={meeting.id}
                              className={cn(
                                "flex items-start gap-3 rounded-xl px-3.5 py-3 cursor-pointer transition-colors",
                                isNow ? "bg-slate-100 hover:bg-slate-200" : "bg-white hover:bg-slate-50 border border-slate-100"
                              )}
                              onClick={(e) => { e.stopPropagation(); onSelectSchedule(meeting); }}
                            >
                              <div className={cn(
                                "mt-0.5 w-1.5 h-1.5 rounded-full shrink-0",
                                isNow ? "bg-slate-900" : "bg-slate-300"
                              )} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-800 truncate">{meeting.title}</p>
                                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                  <User className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{meeting.creator?.full_name} • {meeting.participants?.length || 0} người</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                                  {fmtTime(new Date(meeting.start_time))} – {fmtTime(new Date(meeting.end_time))}
                                </p>
                                <p className="text-xs text-slate-500 tabular-nums">{fmtDateShort(new Date(meeting.start_time))}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
