'use client';

import React, { useMemo } from 'react';
import { TaskCard } from './TaskCard';
import { groupByBatch } from '../_lib/batchHelpers';
import type { TaskListItem } from '../_lib/types';
import { DATE_GROUP_LABEL, type DateGroup } from '../_lib/constants';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Props {
  items: TaskListItem[];
  onOpen?: (taskId: string) => void;
  onOpenBatch?: (batchId: string) => void;
  currentProfile?: { id: string; role: string; department_id: string | null } | null;
}

function classifyTask(item: TaskListItem): DateGroup {
  if (item.status === 'done' || item.status === 'canceled') return 'completed';
  if (!item.due_date) return 'no_deadline';
  if (item.is_overdue) return 'overdue';
  const due = new Date(item.due_date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  if (dueDay.getTime() === today.getTime()) return 'today';
  const diffDays = (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 0 && diffDays <= 7) return 'this_week';
  return 'later';
}

const GROUP_ORDER: DateGroup[] = ['overdue', 'today', 'this_week', 'later', 'no_deadline', 'completed'];

export function TaskListSection({ items, onOpen, onOpenBatch, currentProfile }: Props) {
  const entries = useMemo(() => groupByBatch(items), [items]);

  const grouped = useMemo(() => {
    const map = new Map<DateGroup, typeof entries>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const entry of entries) {
      const dateGroup = classifyTask(entry.representative);
      map.get(dateGroup)?.push(entry);
    }
    return Array.from(map.entries()).filter(([, v]) => v.length > 0);
  }, [entries]);

  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  return (
    <div className="group-stack">
      {grouped.map(([group, groupItems]) => {
        if (group === 'completed') {
          return (
            <section key={group} className="item-stack mt-6">
              <button
                onClick={() => setIsCompletedOpen(!isCompletedOpen)}
                className="flex items-center gap-2 w-full text-left heading-card font-bold px-0.5 text-slate-500 hover:text-slate-700 transition-colors"
              >
                {isCompletedOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                {DATE_GROUP_LABEL[group]} ({groupItems.length})
              </button>
              {isCompletedOpen && (
                <div className="space-y-2 mt-2">
                  {groupItems.map(entry =>
                    <TaskCard
                      key={entry.batchId ?? entry.representative.id}
                      representative={entry.representative}
                      children={entry.children}
                      onOpen={() => {
                        if (entry.batchId) {
                          onOpenBatch?.(entry.batchId);
                        } else {
                          onOpen?.(entry.representative.id);
                        }
                      }}
                      currentProfile={currentProfile}
                    />
                  )}
                </div>
              )}
            </section>
          );
        }

        return (
          <section key={group} className="item-stack">
            <h3 className="heading-card font-bold px-0.5">{DATE_GROUP_LABEL[group]}</h3>
            <div className="space-y-2">
              {groupItems.map(entry =>
                <TaskCard
                  key={entry.batchId ?? entry.representative.id}
                  representative={entry.representative}
                  children={entry.children}
                  onOpen={() => {
                    if (entry.batchId) {
                      onOpenBatch?.(entry.batchId);
                    } else {
                      onOpen?.(entry.representative.id);
                    }
                  }}
                  currentProfile={currentProfile}
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
