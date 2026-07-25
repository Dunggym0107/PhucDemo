'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Plus, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useAppData } from '@/hooks/use-app-data';
import { canCreateRecurringTemplate } from '@/lib/permissions';
import { useRecurringTemplates } from '../_hooks/useRecurringTemplates';
import { RecurringTemplateCard } from '../_components/RecurringTemplateCard';
import { RecurringTemplateDialog } from '../_components/RecurringTemplateDialog';
import type { RecurringTemplate } from '../_lib/recurringHelpers';

function RecurringContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const createParam = searchParams.get('create') === '1';

  const { currentProfile } = useAppData();
  const profile = currentProfile;
  const [editing, setEditing] = useState<RecurringTemplate | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    if (!canCreateRecurringTemplate(profile)) router.replace('/dashboard/tasks');
  }, [profile?.id, router]);

  // Mobile FAB / deep-link: mở dialog khi URL có ?create=1
  useEffect(() => {
    if (createParam && !open) { setEditing(null); setOpen(true); }
  }, [createParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const { loading, items, refetch } = useRecurringTemplates(!!profile);

  const cleanCreateParam = () => {
    if (!createParam) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('create');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleEdit = (t: RecurringTemplate) => { setEditing(t); setOpen(true); };
  const handleSetOpen = (v: boolean) => {
    setOpen(v);
    if (!v) cleanCreateParam();
  };

  return (
    <div className="page-container group-stack motion-safe:animate-fade-in-up">
      <PageHeader
        title="Lịch định kỳ"
        description="Tự động tạo công việc định kỳ theo mẫu đã thiết lập."
        action={
          <Button onClick={handleNew} className="px-5 font-semibold shadow-sm">
            <Plus className="icon-sm" /> Tạo mẫu định kỳ
          </Button>
        }
      />

      {loading ? (
        <ListSkeleton rows={4} variant="card" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="icon-lg" />}
          title="Chưa có công việc định kỳ nào"
          description="Tạo mẫu để hệ thống tự sinh công việc định kỳ."
          actionLabel="Tạo mẫu định kỳ đầu tiên"
          onAction={handleNew}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map(t => (
            <RecurringTemplateCard key={t.id} template={t} onEdit={handleEdit} onChanged={refetch} />
          ))}
        </div>
      )}

      <RecurringTemplateDialog
        isOpen={open}
        setIsOpen={handleSetOpen}
        editing={editing}
        onSaved={refetch}
      />
    </div>
  );
}

export default function RecurringPage() {
  return (
    <Suspense fallback={
      <div className="page-container py-10">
        <ListSkeleton rows={4} variant="card" />
      </div>
    }>
      <RecurringContent />
    </Suspense>
  );
}
