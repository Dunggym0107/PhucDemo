'use client'

import React from "react";
import { Car, CheckCircle2, Navigation } from "lucide-react";

interface Props {
  totalTrips: number;
  activeTrip: any;
  driverStatus: string;
}

export default function DriverStatsGrid({ totalTrips, activeTrip, driverStatus }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
      <div className="p-3 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100/80 shadow-sm transition-all duration-300 flex flex-col justify-between h-28 sm:h-32">
        <div className="flex items-center justify-between w-full">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-900/5 flex items-center justify-center shrink-0">
            <Car className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900" />
          </div>
        </div>
        <div className="space-y-0.5 sm:space-y-1">
          <p className="text-xs sm:text-xs font-semibold text-slate-500 truncate">Tổng chuyến</p>
          <p className="text-lg sm:heading-page tabular-nums truncate">
            {totalTrips}
          </p>
        </div>
      </div>


      <div className="p-3 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100/80 shadow-sm transition-all duration-300 hover:bg-white hover:shadow-lg active:scale-95 flex flex-col justify-between h-28 sm:h-32">
        <div className="flex items-center justify-between w-full">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${activeTrip ? "bg-emerald-50 animate-pulse" : "bg-slate-900/5"}`}>
            {activeTrip ? (
              <Navigation className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            )}
          </div>
        </div>
        <div className="space-y-0.5 sm:space-y-1">
          <p className="text-xs sm:text-xs font-semibold text-slate-500 truncate">Trạng thái</p>
          <p className={`text-sm sm:text-lg font-bold truncate ${activeTrip ? "text-emerald-600" : "text-slate-900"}`}>
            {driverStatus}
          </p>
        </div>
      </div>
    </div>
  );
}
