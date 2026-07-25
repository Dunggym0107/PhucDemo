'use client'

import React, { useEffect, useMemo, useState } from "react";
import { Users, Plane, Sparkles, UserMinus, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import PageHeader from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canViewPeopleDirectory } from "@/lib/permissions";
import { useTeamDirectory } from "../_hooks/useTeamDirectory";
import { getProfileBadgeStatus, matchProfileSearch } from "../_lib/utils";
import { ProfileStatus, STATUS_BADGES } from "../_lib/constants";
import ProfileDetailDialog from "./ProfileDetailDialog";
import OrgChartView from "./OrgChartView";

// Container chính cho /dashboard/team — 1 view duy nhất (org-chart style).
const FILTER_TABS: Array<{ key: ProfileStatus | 'all'; label: string; icon: React.ReactNode }> = [
  { key: 'all', label: 'Tất cả', icon: <Users className="icon-md" /> },
  { key: 'on_leave', label: STATUS_BADGES.on_leave.label, icon: <UserMinus className="icon-md" /> },
  { key: 'on_trip', label: STATUS_BADGES.on_trip.label, icon: <Plane className="icon-md" /> },
  { key: 'new_joiner', label: 'Mới vào', icon: <Sparkles className="icon-md" /> },
];

export default function TeamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailId = searchParams.get('id');
  const query = searchParams.get('q') || '';
  const { profile, members, todaySchedules, oooByUser, loading } = useTeamDirectory();

  const [filter, setFilter] = useState<ProfileStatus | 'all'>('all');

  // Guard role — driver redirect.
  useEffect(() => {
    if (!loading && profile && !canViewPeopleDirectory(profile)) {
      router.replace('/dashboard');
    }
  }, [loading, profile, router]);

  const getStatus = useMemo(() => {
    const cache = new Map<string, ProfileStatus>();
    return (m: any): ProfileStatus => {
      if (cache.has(m.id)) return cache.get(m.id)!;
      const s = getProfileBadgeStatus(m, todaySchedules, oooByUser.get(m.id) ?? null, profile);
      cache.set(m.id, s);
      return s;
    };
  }, [todaySchedules, oooByUser, profile]);



  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (!matchProfileSearch(m, query)) return false;
      if (filter === 'all') return true;
      return getStatus(m) === filter;
    });
  }, [members, query, filter, getStatus]);

  const openDetail = (member: any) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('id', member.id);
    router.push(`/dashboard/team?${params.toString()}`, { scroll: false });
  };

  const closeDetail = (open: boolean) => {
    if (open) return;
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.delete('id');
    const q = params.toString();
    router.push(`/dashboard/team${q ? `?${q}` : ''}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="page-container space-y-6 md:section-stack motion-safe:animate-fade-in-up">
        <PageHeader title="Nhân sự" description="Danh bạ và sơ đồ tổ chức chi nhánh" />
        <ListSkeleton variant="card" rows={6} />
      </div>
    );
  }

  return (
    <div className="page-container space-y-6 md:section-stack motion-safe:animate-fade-in-up">
      <PageHeader
        title="Nhân sự"
        description="Danh bạ và sơ đồ tổ chức chi nhánh"
      />


      {/* Filter status = Tabs (đồng bộ pattern với module Tasks) */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as ProfileStatus | 'all')} className="w-full">
        <TabsList className="min-h-11 grid grid-cols-4">
          {FILTER_TABS.map((opt) => (
            <TabsTrigger
              key={opt.key}
              value={opt.key}
              className="rounded-lg py-1.5 font-semibold text-sm flex items-center justify-center gap-1.5 px-1 md:px-3"
            >
              {opt.icon}
              <span className="truncate hidden md:inline-block">{opt.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center">
        <span className="text-meta">{filteredMembers.length} người</span>
      </div>

      {filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Users className="icon-lg" />}
          title="Không có kết quả phù hợp"
          description={query ? "Thử bỏ bộ lọc hoặc đổi từ khoá tìm kiếm trên thanh tìm." : "Thử bỏ bộ lọc."}
        />
      ) : (
        <OrgChartView members={filteredMembers} onSelect={openDetail} getStatus={getStatus} />
      )}

      <ProfileDetailDialog
        targetId={detailId}
        open={!!detailId}
        onOpenChange={closeDetail}
        viewer={profile}
        todaySchedules={todaySchedules}
      />
    </div>
  );
}


