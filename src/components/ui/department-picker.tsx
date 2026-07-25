'use client';

import React, { useMemo, useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { SelectionPill } from './people-picker';

export interface PickableItem {
  id: string;
  name: string;
  code?: string | null;
}

interface DepartmentPickerProps {
  items: PickableItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  triggerLabel?: string;
}

export function DepartmentPicker({
  items, selected, onChange, triggerLabel = 'Chọn phòng ban',
}: DepartmentPickerProps) {
  const [open, setOpen] = useState(false);

  const allIds = useMemo(() => items.map(i => i.id), [items]);
  const isAllSelected = allIds.length > 0 && allIds.every(id => selected.includes(id));

  const selectedItems = useMemo(
    () => selected.map(id => items.find(i => i.id === id)).filter(Boolean) as PickableItem[],
    [selected, items],
  );

  return (
    <div className="item-stack">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'w-full min-h-11 flex items-center gap-3 rounded-xl border bg-white px-3 py-2 text-left transition-all',
              'hover:bg-slate-50',
              selected.length > 0 && 'border-primary/20',
            )}
          >
            <Building2 className="icon-md text-slate-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="heading-card truncate">
                {selected.length === 0 ? triggerLabel : `Đã chọn ${selected.length} phòng`}
              </p>
            </div>
            <span className="text-meta font-bold bg-slate-100 rounded-full px-2 py-0.5 shrink-0">
              {selected.length > 0 ? `${selected.length}/${items.length}` : items.length}
            </span>
            <ChevronDown className={cn('icon-md text-slate-500 transition-transform', open && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="pt-2 item-stack">
            {items.length > 1 && (
              <div className="flex items-center justify-end px-1">
                <button
                  type="button"
                  onClick={() => onChange(isAllSelected ? [] : allIds)}
                  className="text-subtitle font-semibold text-primary hover:underline min-h-9 px-2"
                >
                  {isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map(d => {
                const isSelected = selected.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      onChange(isSelected ? selected.filter(x => x !== d.id) : [...selected, d.id])
                    }
                    className={cn(
                      'flex items-center gap-3 min-h-11 px-3 py-2 rounded-full border text-left transition-all',
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'bg-white border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <Building2 className="icon-md text-slate-500 shrink-0" />
                    <span className="flex-1 font-medium truncate">{d.name}</span>
                    {isSelected && <Check className="icon-lg text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {selectedItems.length > 0 && (
        <SelectionPill
          countLabel={
            selectedItems.length <= 3
              ? selectedItems.map(i => i.name).join(', ')
              : `${selectedItems.length} phòng đã chọn`
          }
          onClear={() => onChange([])}
        />
      )}
    </div>
  );
}
