'use client'

import React from "react";
import { AlertTriangle, Car, CheckCircle2, Clock, MapPin, Navigation, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  trip: any;
  onConfirm: (trip: any) => void;
  onStart: (trip: any) => void;
  onEnd: (trip: any) => void;
  onReportIssue: (trip: any) => void;
  onReject: (trip: any, reason: string) => void;
}

const fmtDt = (d: Date) =>
  d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function MyTripCard({ trip, onConfirm, onStart, onEnd, onReportIssue, onReject }: Props) {
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectSubmitting, setRejectSubmitting] = React.useState(false);
  const hasStarted = trip.status === 'in_progress' || trip.status === 'completed' || !!trip.metadata?.trip_started_at;
  const hasEnded = trip.status === 'completed' || !!trip.metadata?.trip_ended_at;
  const isConfirmed = !!trip.metadata?.driver_confirmed_at;
  const hasIssue = !!trip.metadata?.vehicle_issue;
  const startDt = new Date(trip.start_time);
  const endDt = new Date(trip.end_time);

  let borderStyle = "border-l-4 border-l-amber-500 border-slate-100";
  let statusBadgeBg = "status-warning-bg";
  let statusText = "Chờ khởi hành";
  let statusIcon: React.ReactNode = <Clock className="w-3.5 h-3.5 shrink-0" />;

  if (!isConfirmed && trip.status === 'approved' && !hasStarted) {
    statusText = "Chờ xác nhận";
    statusIcon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
  }

  if (hasEnded) {
    borderStyle = "border-l-4 border-l-slate-200 border-slate-100 opacity-80";
    statusBadgeBg = "bg-slate-50 text-slate-500 border-slate-100";
    statusText = "Đã hoàn thành";
    statusIcon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
  } else if (hasStarted) {
    borderStyle = "border-l-4 border-l-emerald-500 border-slate-100 ring-1 ring-emerald-500/10";
    statusBadgeBg = "status-success-bg";
    statusText = "Đang di chuyển";
    statusIcon = <Navigation className="w-3.5 h-3.5 shrink-0" />;
  }

  return (
    <div className={`bg-white rounded-2xl border ${borderStyle} shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50 bg-slate-50/20">
        <div className="flex items-center gap-2">
          <Badge className={`gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeBg}`}>
            {statusIcon}
            {statusText}
          </Badge>
          {hasIssue && (
            <Badge className="gap-1 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
              <AlertTriangle className="w-3 h-3 shrink-0 animate-pulse" /> Sự cố
            </Badge>
          )}
        </div>
        <span className="text-xs font-semibold text-slate-500 tabular-nums">
          {fmtDt(startDt).split(' ')[1]}
        </span>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 flex-1">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-primary transition-colors">
            {trip.title}
          </h4>
          {trip.description && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{trip.description}</p>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
              <Car className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <span className="text-sm font-semibold text-slate-800">
              {(trip.vehicle as any)?.name
                ? `${(trip.vehicle as any).name} · ${(trip.vehicle as any).plate_number}`
                : <span className="text-slate-500 font-normal italic">Chờ phân công xe</span>}
            </span>
          </div>

          {trip.location && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5 border border-slate-100/30">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <span className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{trip.location}</span>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5 border border-slate-100/80">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-sm text-slate-500 space-y-0.5 font-medium">
              <div><span className="text-slate-500 text-xs font-semibold">Đi:</span> {fmtDt(startDt)}</div>
              {hasEnded ? (
                <div><span className="text-slate-500 text-xs font-semibold">Đến:</span> {fmtDt(new Date(trip.metadata?.trip_ended_at || endDt))}</div>
              ) : hasStarted ? (
                <div><span className="text-amber-600 text-xs font-semibold">Đang đến:</span> <span className="text-amber-600">{fmtDt(new Date())}</span></div>
              ) : null}
            </div>
          </div>
          
          {trip.metadata?.destinations && trip.metadata.destinations.length > 0 && (
            <div className="flex items-start gap-3 mt-2">
              <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100/30">
                <Navigation className="w-3 h-3 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                  {trip.metadata.destinations.map((d: any) => d.location).join(' ➔ ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {trip.participants && trip.participants.length > 0 && (
          <div className="pt-3 mt-2 border-t border-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Người đi cùng ({trip.participants.filter((p: any) => p.profile?.role !== 'driver').length})</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {trip.participants.filter((p: any) => p.profile?.role !== 'driver').map((p: any) => (
                <div key={p.profile?.id} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                  <Avatar className="w-5 h-5 shrink-0">
                    <AvatarImage src={p.profile?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {p.profile?.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">
                    {p.profile?.full_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!hasEnded && (
        <div className="flex items-center gap-2 px-5 pb-5 pt-1 bg-slate-50/10">
          {!isConfirmed && trip.status === 'approved' && !hasStarted ? (
            <>
              <Button
                onClick={() => onConfirm(trip)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold min-h-11 text-sm gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Xác nhận lịch
              </Button>
              <Button
                onClick={() => setRejectOpen(true)}
                variant="outline"
                className="flex-1 min-h-11 rounded-xl font-bold text-sm border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 gap-1.5 active:scale-95 transition-all duration-150"
              >
                <XCircle className="w-3.5 h-3.5" /> Từ chối
              </Button>
            </>
          ) : !hasStarted ? (
            <Button
              onClick={() => onStart(trip)}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold min-h-11 text-sm gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
            >
              <Navigation className="w-3.5 h-3.5" /> Bắt đầu chuyến
            </Button>
          ) : (
            <Button
              onClick={() => onEnd(trip)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold min-h-11 text-sm gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Kết thúc chuyến
            </Button>
          )}
          <Button
            onClick={() => onReportIssue(trip)}
            variant="ghost"
            title="Báo sự cố"
            className="h-11 w-11 p-0 shrink-0 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all duration-150"
          >
            <AlertTriangle className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Dialog từ chối */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <XCircle className="icon-md text-red-600" />
              <DialogTitle className="text-lg font-semibold text-slate-900">Từ chối lịch chạy xe</DialogTitle>
            </div>
            <DialogDescription className="text-label leading-relaxed">
              Nhập lý do từ chối chuyến <span className="font-semibold text-slate-700">&ldquo;{trip.title}&rdquo;</span> để bộ phận điều phối biết và sắp xếp lại.
            </DialogDescription>
          </DialogHeader>

          <div className="item-stack">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Vd: Bận việc gia đình, đã có lịch ngoài giờ..."
              rows={4}
              className="resize-none"
              autoFocus
            />
            <p className={cn(
              "text-xs font-medium",
              rejectReason.trim().length >= 10 ? "text-slate-500" : "text-amber-600"
            )}>
              {rejectReason.trim().length >= 10
                ? `${rejectReason.trim().length} ký tự`
                : `Cần thêm ${10 - rejectReason.trim().length} ký tự (tối thiểu 10).`}
            </p>
          </div>

          <DialogFooter className="mt-2 gap-3">
            <Button
              variant="ghost"
              onClick={() => { setRejectOpen(false); setRejectReason(""); }}
              disabled={rejectSubmitting}
              className="rounded-xl min-h-11 font-medium"
            >Huỷ</Button>
            <Button
              onClick={async () => {
                if (rejectReason.trim().length < 10 || rejectSubmitting) return;
                setRejectSubmitting(true);
                try {
                  await onReject(trip, rejectReason.trim());
                  setRejectOpen(false);
                  setRejectReason("");
                } finally {
                  setRejectSubmitting(false);
                }
              }}
              disabled={rejectReason.trim().length < 10 || rejectSubmitting}
              className="rounded-xl min-h-11 font-medium px-6 bg-red-600 hover:bg-red-700 text-white border-none"
            >
              {rejectSubmitting ? 'Đang gửi...' : 'Xác nhận từ chối'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
