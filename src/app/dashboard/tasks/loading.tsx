'use client';

import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/ui/list-skeleton';

export default function Loading() {
  return (
    <div className="page-container space-y-6 md:section-stack motion-safe:animate-fade-in-up">
      <PageHeader
        title="Công việc"
        description="Quản trị & theo dõi tiến độ"
      />
      {/* Tabs giả lập */}
      <div className="h-11 w-full bg-slate-100/80 rounded-lg animate-pulse" />
      <ListSkeleton rows={6} variant="card" />
    </div>
  );
}
