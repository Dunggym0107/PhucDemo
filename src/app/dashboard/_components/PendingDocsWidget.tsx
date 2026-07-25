'use client';

// PendingDocsWidget — tách từ TaskOverview cũ.
// Hiển thị hồ sơ vật lý đang chờ tôi nhận hoặc đang ở bàn tôi.
// KHÔNG hiển thị hồ sơ tôi đã chuyển đi (có outgoing PENDING từ tôi) —
// chúng đang chờ người khác hành động, không phải tôi.

import React, { useMemo } from 'react';
import Link from 'next/link';
import { FolderOpen, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import type { PendingDocItem, PendingDocHandover } from '../_lib/types';

type DocLevel = 'incoming' | 'safe' | 'warn' | 'danger';

// Tìm handover PENDING liên quan tới user hiện tại trong handovers của 1 doc.
function findUserPendingHandover(doc: PendingDocItem, userId: string | null) {
  if (!userId) return null;
  const handovers = doc.handovers || [];
  return handovers.find(
    (h: PendingDocHandover) =>
      h.status === 'PENDING' && (h.receiver_id === userId || h.sender_id === userId),
  ) || null;
}

// Tính nhanh SLA cho 1 doc — không import từ module handover để tránh vòng tròn.
function getDocSlaLevel(doc: PendingDocItem, userId: string | null): DocLevel {
  // Có người chuyển cho tôi đang chờ tôi nhận → ưu tiên hiển thị "Chờ tôi nhận"
  const pending = findUserPendingHandover(doc, userId);
  if (pending && pending.receiver_id === userId) return 'incoming';

  const slaHours = doc.category?.sla_hours;
  if (!slaHours || slaHours <= 0) return 'safe';

  const accepted = (doc.handovers || []).filter((h) => h.status === 'ACCEPTED');
  const startedAt = accepted.reduce<string | null>((max, h) => {
    if (!h.received_at) return max;
    return !max || new Date(h.received_at) > new Date(max) ? h.received_at : max;
  }, null) || doc.created_at;

  const elapsedHours = (Date.now() - new Date(startedAt).getTime()) / 3_600_000;
  const used = elapsedHours / slaHours;
  if (used >= 1) return 'danger';
  if (used >= 0.7) return 'warn';
  return 'safe';
}

const SLA_DOT_CLASS: Record<DocLevel, string> = {
  incoming: 'bg-amber-400 animate-pulse',
  safe:     'bg-emerald-500',
  warn:     'bg-amber-500',
  danger:   'bg-red-500 animate-pulse',
};

const SLA_LABEL: Record<DocLevel, string> = {
  incoming: 'Chờ tôi nhận',
  safe:     'Trong SLA',
  warn:     'Sắp hết SLA',
  danger:   'Quá hạn',
};

interface Props {
  docs: PendingDocItem[];
  currentUserId: string | null;
}

export default function PendingDocsWidget({ docs, currentUserId }: Props) {
  // Phòng trường hợp DB chưa migrate: lọc bỏ doc tôi đã chuyển đi (có outgoing PENDING từ tôi)
  // và không có incoming PENDING cho tôi.
  const visibleDocs = useMemo(() => {
    if (!currentUserId) return docs;
    return docs.filter((doc) => {
      const pending = findUserPendingHandover(doc, currentUserId);
      if (!pending) return true;
      return pending.receiver_id === currentUserId;
    });
  }, [docs, currentUserId]);

  return (
    <div className="item-stack">
      <div className="flex items-center justify-between px-2">
        <h3 className="heading-card flex items-center gap-2 truncate whitespace-nowrap">
          <FolderOpen className="icon-md text-primary" /> Hồ sơ cần xử lý
        </h3>
        {visibleDocs.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {visibleDocs.length}
          </span>
        )}
      </div>

      <div className="premium-card p-4 border-none tight-stack">
        {visibleDocs.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="icon-lg" />}
            title="Bàn của bạn đang trống"
            description="Khi có hồ sơ vật lý chờ nhận hoặc đang giữ, hệ thống sẽ hiện tại đây."
            variant="subtle"
          />
        ) : (
          <>
            {visibleDocs.map((doc) => {
              const level = getDocSlaLevel(doc, currentUserId);
              return (
                <Link
                  key={doc.id}
                  href={`/dashboard/handover?id=${doc.id}`}
                  className="block group"
                >
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-transparent hover:bg-slate-50 hover:border-slate-100 transition-all min-h-11">
                    <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', SLA_DOT_CLASS[level])} />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                        {doc.short_code}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-primary transition-colors">
                        {doc.title}
                      </p>
                      <p className="text-meta">
                        {SLA_LABEL[level]}
                        {doc.category?.name && <span> · {doc.category.name}</span>}
                      </p>
                    </div>
                    <ChevronRight className="icon-sm text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              );
            })}
            <div className="pt-2">
              <Button asChild variant="ghost" className="w-full min-h-11 rounded-xl text-sm font-medium text-primary hover:bg-primary/5">
                <Link href="/dashboard/handover">Xem tất cả hồ sơ <ChevronRight className="ml-1 icon-sm" /></Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
