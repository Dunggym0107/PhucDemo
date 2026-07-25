'use client';

import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/ui/list-skeleton';

export default function Loading() {
  return (
    <div className="page-container space-y-10 motion-safe:animate-fade-in-up">
      <PageHeader
        title="Lịch trình"
        description="Điều phối lịch họp & công tác"
      />
      <ListSkeleton variant="card" rows={6} />
    </div>
  );
}
