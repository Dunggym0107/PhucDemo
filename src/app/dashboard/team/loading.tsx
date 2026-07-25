'use client';

import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/ui/list-skeleton';

export default function Loading() {
  return (
    <div className="page-container space-y-6 md:section-stack motion-safe:animate-fade-in-up">
      <PageHeader 
        title="Nhân sự" 
        description="Danh bạ và sơ đồ tổ chức chi nhánh" 
      />
      <ListSkeleton variant="card" rows={6} />
    </div>
  );
}
