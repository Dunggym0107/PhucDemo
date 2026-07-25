'use client';

import React from 'react';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="page-container section-stack pt-4">
      <header className="flex flex-col gap-4 pt-4 sm:pt-0 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-72 rounded-lg" />
          </div>
        </div>
      </header>
      
      {/* KPI Card Loading Skeleton */}
      <div className="premium-card p-4 sm:p-5">
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center justify-center text-center px-2 py-1 space-y-2.5">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-3 w-14 rounded" />
              <Skeleton className="h-6 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ListSkeleton variant="card" rows={4} />
        </div>
        <div className="lg:col-span-4">
          <ListSkeleton variant="card" rows={3} />
        </div>
      </div>
    </div>
  );
}
