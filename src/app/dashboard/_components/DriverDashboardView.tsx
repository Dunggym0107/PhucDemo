'use client'

import React from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import DriverDashboard from "../schedule/_components/DriverDashboard";

interface DriverViewProps {
  profile: any;
  schedules: any[];
  fetchData: () => Promise<void>;
  toast: any;
}

export default function DriverDashboardView({ profile, schedules, fetchData, toast }: DriverViewProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 group-stack md:section-stack motion-safe:animate-fade-in-up pb-20">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
        <div className="space-y-1">
          <h1 className="heading-page">Lịch trình của tôi</h1>
          <p className="text-subtitle">Theo dõi chuyến được gán, cập nhật hành trình.</p>
        </div>
        <Button asChild variant="outline" className="h-11 rounded-xl font-bold">
          <Link href="/dashboard/schedule">
            <CalendarDays className="mr-2 icon-md" /> Xem lịch đầy đủ
          </Link>
        </Button>
      </header>
      <DriverDashboard schedules={schedules} profile={profile} fetchData={fetchData} toast={toast} />
    </div>
  );
}
