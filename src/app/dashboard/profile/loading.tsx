'use client';

import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="page-container space-y-6 md:section-stack motion-safe:animate-fade-in-up">
      <PageHeader title="Trang cá nhân" description="Thông tin tài khoản và lịch sử hoạt động" />
      <div className="premium-card p-6 group-stack">
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="item-stack flex-1 text-center sm:text-left">
            <Skeleton className="h-6 w-48 mx-auto sm:mx-0 rounded" />
            <Skeleton className="h-4 w-32 mx-auto sm:mx-0 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
