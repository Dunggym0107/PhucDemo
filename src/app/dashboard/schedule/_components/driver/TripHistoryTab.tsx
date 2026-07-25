import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Car, Clock, MapPin, Loader2, Navigation, CheckCircle2, CalendarIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compareProfilesByHierarchy } from "@/lib/utils";

interface Props {
  profileId: string;
}

export default function TripHistoryTab({ profileId }: Props) {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const supabase = createClient();

  useEffect(() => {
    if (profileId) loadTrips();
  }, [profileId, dateRange]);

  const loadTrips = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('schedules')
        .select('*, vehicle:vehicles(id, name, plate_number), department:departments!schedules_department_id_fkey(name), creator:profiles!schedules_created_by_fkey(id, role, is_department_head, department:departments(name)), participants:schedule_participants(profile:profiles(id, role, is_department_head, department:departments(name)))')
        .eq('type', 'trip')
        .eq('driver_id', profileId)
        .eq('status', 'completed')
        .order('end_time', { ascending: false });

      if (dateRange?.from) {
        const start = new Date(dateRange.from);
        start.setHours(0, 0, 0, 0);
        query = query.gte('end_time', start.toISOString());
      }
      if (dateRange?.to) {
        const end = new Date(dateRange.to);
        end.setHours(23, 59, 59, 999);
        query = query.lte('end_time', end.toISOString());
      } else if (dateRange?.from) { // exact date
        const end = new Date(dateRange.from);
        end.setHours(23, 59, 59, 999);
        query = query.lte('end_time', end.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setTrips(data || []);
    } catch (err) {
      console.error("Lỗi khi tải lịch sử chuyến đi:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-2">
        <div className="w-full sm:w-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-[260px] justify-start text-left font-normal h-9 rounded-lg bg-slate-50 border-none hover:bg-slate-100 transition-colors text-xs"
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                      {format(dateRange.to, "dd/MM/yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "dd/MM/yyyy")
                  )
                ) : (
                  <span className="text-slate-500">Chọn khoảng thời gian...</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-xl" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                locale={vi}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="w-full sm:w-auto">
          <Button 
            variant="ghost"
            onClick={() => setDateRange(undefined)}
            disabled={!dateRange?.from}
            className="w-full h-9 rounded-lg text-slate-500 font-semibold hover:bg-slate-50 text-xs"
          >
            Bỏ lọc
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : trips.length === 0 ? (
        <EmptyState
          icon={<Car className="w-8 h-8 text-slate-300" />}
          title="Không tìm thấy chuyến đi"
          description="Không có chuyến xe nào hoàn thành trong khoảng thời gian này."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="text-slate-600 text-xs py-2 h-9">Thời gian</TableHead>
                  <TableHead className="text-slate-600 text-xs py-2 h-9">Đơn vị</TableHead>
                  <TableHead className="text-slate-600 text-xs py-2 h-9">Phương tiện</TableHead>
                  <TableHead className="text-slate-600 text-xs py-2 h-9">Lộ trình</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => {
                  const startDt = new Date(trip.start_time);
                  const endDt = new Date(trip.metadata?.trip_ended_at || trip.end_time);
                  const startStr = format(startDt, "dd/MM/yyyy");
                  const endStr = format(endDt, "dd/MM/yyyy");
                  const timeStr = startStr === endStr ? startStr : `${startStr} - ${endStr}`;

                  return (
                    <TableRow key={trip.id} className="hover:bg-slate-50/50 border-slate-50">
                      <TableCell className="py-2 align-top">
                        <span className="font-semibold text-slate-700 text-xs whitespace-nowrap">{timeStr}</span>
                      </TableCell>
                      <TableCell className="py-2 align-top">
                        <div className="flex items-start">
                          <span className="text-xs text-slate-600 whitespace-nowrap leading-relaxed font-medium">
                            {(() => {
                              const sortedParticipants = [...(trip.participants || [])].sort((a: any, b: any) => compareProfilesByHierarchy(a.profile, b.profile));
                              const depts = sortedParticipants
                                .map((p: any) => p.profile?.department?.name)
                                .filter(Boolean);
                              const uniqueDepts = Array.from(new Set(depts));
                              const displayDept = uniqueDepts.length > 0 ? uniqueDepts.join(', ') : (trip.department?.name || trip.creator?.department?.name);
                              
                              return displayDept || <span className="italic text-slate-400">Không có</span>;
                            })()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 align-top">
                        <div className="flex items-start gap-1.5 mt-0.5">
                          <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-xs font-medium text-slate-700 whitespace-nowrap leading-snug">
                            {(trip.vehicle as any)?.name ? `${(trip.vehicle as any).name} · ${(trip.vehicle as any).plate_number}` : 'Chưa có thông tin'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 align-top">
                        <div className="flex flex-col gap-1 min-w-[250px]">
                          {trip.metadata?.destinations && trip.metadata.destinations.length > 0 ? (
                            <div className="flex items-start gap-1.5">
                              <Navigation className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-600 whitespace-nowrap leading-relaxed">
                                {trip.metadata.destinations.map((d: any) => d.location).join(' ➔ ')}
                              </span>
                            </div>
                          ) : trip.location ? (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-600 whitespace-nowrap leading-relaxed">{trip.location}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Chưa có lộ trình</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
