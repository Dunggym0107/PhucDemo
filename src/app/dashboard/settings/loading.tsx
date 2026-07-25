'use client';

import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="page-container space-y-6 md:section-stack motion-safe:animate-fade-in-up">
      <PageHeader title="Cài đặt" description="Cấu hình tài khoản và thông báo" />
      <div className="premium-card p-6 group-stack">
        <div className="space-y-4">
          <Skeleton className="h-4 w-1/4 rounded" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
