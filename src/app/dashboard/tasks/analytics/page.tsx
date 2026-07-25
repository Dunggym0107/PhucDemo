'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, BarChart3 } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/layout/PageHeader';
import { useAppData } from '@/hooks/use-app-data';
import { canViewTaskAnalytics, canViewBranchAnalytics } from '@/lib/permissions';
import { useTaskAnalytics } from '../_hooks/useTaskAnalytics';
import { AnalyticsKpiCards } from '../_components/analytics/AnalyticsKpiCards';
import { OverdueByDeptChart } from '../_components/analytics/OverdueByDeptChart';
import { ResourceView } from '../_components/ResourceView';
import { TopOverduePeopleList } from '../_components/analytics/TopOverduePeopleList';
import { rowsToCsv, downloadCsv } from '../_lib/analyticsHelpers';
import { DepartmentPicker } from '@/components/ui/department-picker';

type Range = 'week' | 'month';

export default function AnalyticsPage() {
  const router = useRouter();
  const { currentProfile, departments } = useAppData();
  const profile = currentProfile;
  const [range, setRange] = useState<Range>('week');
  const [deptFilter, setDeptFilter] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    if (!canViewTaskAnalytics(profile)) {
      router.replace('/dashboard/tasks');
      return;
    }
  }, [profile?.id, router]);

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (range === 'week') {
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }, [range]);

  const deptId = deptFilter[0] ?? null;
  const { loading, data, error } = useTaskAnalytics(from, to, deptId, !!profile);

  const canFilterDept = canViewBranchAnalytics(profile);

  const handleExport = () => {
    if (!data) return;
    const headers = [
      { key: 'dept_name', label: 'Phòng ban' },
      { key: 'active', label: 'Đang hoạt động' },
      { key: 'overdue', label: 'Quá hạn' },
      { key: 'completed', label: 'Hoàn thành kỳ này' },
    ];
    const rows = data.by_department.map(d => ({
      dept_name: d.dept_name,
      active: d.active,
      overdue: d.overdue,
      completed: d.completed,
    }));
    const csv = rowsToCsv(rows, headers);
    const name = `bao-cao-cong-viec-${format(from, 'yyyyMMdd')}-${format(to, 'yyyyMMdd')}`;
    downloadCsv(name, csv);
  };

  return (
    <div className="page-container group-stack motion-safe:animate-fade-in-up">
      <PageHeader
        title="Thống kê công việc"
        description={`Từ ${format(from, 'dd/MM', { locale: vi })} đến ${format(to, 'dd/MM/yyyy', { locale: vi })}`}
        action={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!data || loading}
            className="px-5"
          >
            <Download className="icon-sm" /> Tải Excel
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)} className="w-full sm:w-auto">
          <TabsList className="min-h-11">
            <TabsTrigger value="week" className="rounded-lg font-semibold px-5">Tuần này</TabsTrigger>
            <TabsTrigger value="month" className="rounded-lg font-semibold px-5">Tháng này</TabsTrigger>
          </TabsList>
        </Tabs>
        {canFilterDept && departments.length > 0 && (
          <div className="flex-1 min-w-[240px] max-w-md">
            <DepartmentPicker
              items={departments}
              selected={deptFilter}
              onChange={(ids) => setDeptFilter(ids.slice(0, 1))}
              triggerLabel="Tất cả phòng ban"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">Đang tải…</div>
      ) : error ? (
        <div className="flex items-center justify-center py-12 text-red-500">Lỗi: {error}</div>
      ) : !data ? (
        <div className="flex items-center justify-center py-12 text-slate-400">Không có dữ liệu</div>
      ) : (
        <div className="group-stack">
          <AnalyticsKpiCards totals={data.totals} recurringActive={data.recurring_active} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="premium-card p-5 border-none item-stack">
              <h2 className="heading-card flex items-center gap-2">
                <BarChart3 className="icon-md text-primary" />
                Phòng ban
              </h2>
              <OverdueByDeptChart data={data.by_department} />
            </section>

            <TopOverduePeopleList data={data.top_overdue_people} />
          </div>

          {(data.resource_view?.length ?? 0) > 0 && (
            <ResourceView data={data.resource_view} />
          )}
        </div>
      )}
    </div>
  );
}
