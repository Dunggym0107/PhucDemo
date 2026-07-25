'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Crown, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import {
  groupProfilesByDepartment,
  type ProfileLike,
} from '@/lib/profile-grouping';

// ─── AvatarStack ──────────────────────────────────────────────────────────────

interface AvatarStackProps {
  people: Pick<ProfileLike, 'id' | 'full_name' | 'avatar_url'>[];
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function AvatarStack({ people, max = 5, size = 'sm', className }: AvatarStackProps) {
  if (!people || people.length === 0) return null;
  const visible = people.slice(0, max);
  const hidden = Math.max(0, people.length - max);
  const sizeClass = size === 'md' ? 'h-8 w-8' : 'h-6 w-6';
  const textClass = size === 'md' ? 'text-subtitle' : 'text-meta';

  return (
    <div className={cn('flex -space-x-2 overflow-hidden', className)}>
      {visible.map(p => (
        <Avatar key={p.id} className={cn(sizeClass, 'border-2 border-white')}>
          <AvatarImage src={p.avatar_url ?? undefined} />
          <AvatarFallback className={cn('bg-slate-200 font-semibold text-slate-600', textClass)}>
            {p.full_name?.[0] ?? '?'}
          </AvatarFallback>
        </Avatar>
      ))}
      {hidden > 0 && (
        <div className={cn(
          sizeClass,
          textClass,
          'rounded-full bg-slate-100 border-2 border-white flex items-center justify-center font-bold text-slate-500',
        )}>
          +{hidden}
        </div>
      )}
    </div>
  );
}

// ─── PeoplePicker ────────────────────────────────────────────────────────────

interface PeoplePickerProps {
  profiles: ProfileLike[];
  selected: string[];
  onChange: (ids: string[]) => void;
  mode?: 'single' | 'multiple';

  currentUserId?: string;
  excludeCurrentUser?: boolean;

  myDepartmentId?: string | null;
  myDepartmentName?: string | null;

  defaultOpenGroup?: string;
}

export function PeoplePicker({
  profiles,
  selected,
  onChange,
  mode = 'multiple',
  currentUserId,
  excludeCurrentUser,
  myDepartmentId,
  myDepartmentName,
  defaultOpenGroup,
}: PeoplePickerProps) {
  const [openGroup, setOpenGroup] = useState<string>(defaultOpenGroup ?? '');

  const candidates = useMemo(() => {
    if (excludeCurrentUser && currentUserId) {
      return profiles.filter(p => p.id !== currentUserId);
    }
    return profiles;
  }, [profiles, excludeCurrentUser, currentUserId]);

  const groups = useMemo(() => groupProfilesByDepartment(candidates, {
    myDepartmentId,
    myDepartmentName,
  }), [candidates, myDepartmentId, myDepartmentName]);

  // Đảm bảo openGroup hợp lệ khi groups thay đổi (vd: race profiles loading)
  useEffect(() => {
    if (openGroup && groups.length > 0 && !groups.some(g => g.key === openGroup)) {
      setOpenGroup('');
    }
  }, [groups, openGroup]);

  const toggle = (id: string) => {
    if (mode === 'single') { onChange([id]); return; }
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const toggleGroup = (members: ProfileLike[], select: boolean) => {
    if (mode === 'single') return;
    const ids = members.map(m => m.id);
    onChange(select
      ? Array.from(new Set([...selected, ...ids]))
      : selected.filter(x => !ids.includes(x)));
  };

  const totalMembers = useMemo(
    () => groups.reduce((acc, g) => acc + g.members.length, 0),
    [groups],
  );

  const selectedProfiles = useMemo(
    () => selected.map(id => profiles.find(p => p.id === id)).filter(Boolean) as ProfileLike[],
    [selected, profiles],
  );

  return (
    <div className="item-stack">
      {totalMembers === 0 ? (
        <p className="text-subtitle font-medium text-slate-500 text-center py-6">
          Không có người phù hợp
        </p>
      ) : (
        <Accordion
          type="single"
          collapsible
          value={openGroup}
          onValueChange={setOpenGroup}
          className="space-y-2"
        >
          {groups.map(g => {
            const selectedCount = g.members.filter(m => selected.includes(m.id)).length;
            const allSelected = selectedCount === g.members.length && g.members.length > 0;
            return (
              <AccordionItem
                key={g.key}
                value={g.key}
                className={cn(
                  'border border-slate-100 rounded-xl bg-white px-3 overflow-hidden',
                  selectedCount > 0 && 'border-primary bg-primary/[0.04]',
                )}
              >
                <AccordionTrigger className="hover:no-underline py-3 min-h-11">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {g.key === 'bgd' && <Crown className="icon-md text-amber-500 shrink-0" />}
                    <span className="heading-card truncate text-left">{g.label}</span>
                    <span className="ml-auto text-meta font-bold bg-slate-100 rounded-full px-2 py-0.5 shrink-0">
                      {selectedCount > 0 ? `${selectedCount}/${g.members.length}` : g.members.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  {mode === 'multiple' && g.members.length >= 2 && (
                    <div className="flex items-center justify-end px-1 pb-2 border-b border-slate-100 mb-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.members, !allSelected)}
                        className="text-subtitle font-semibold text-primary hover:underline min-h-9 px-2"
                      >
                        {allSelected ? 'Bỏ chọn cả nhóm' : 'Chọn cả nhóm'}
                      </button>
                    </div>
                  )}

                  <div className="space-y-1 pt-1">
                    {g.members.map((p) => (
                      <PersonRow
                        key={p.id}
                        profile={p}
                        selected={selected.includes(p.id)}
                        onClick={() => toggle(p.id)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {mode === 'multiple' && selectedProfiles.length > 0 && (
        <SelectionPill
          avatars={selectedProfiles}
          countLabel={`${selectedProfiles.length} người`}
          onClear={() => onChange([])}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PersonRow({
  profile,
  selected,
  onClick,
}: {
  profile: ProfileLike;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full h-10 flex items-center gap-2 rounded-full pl-1 pr-3 text-left transition-all',
        selected
          ? 'bg-primary/10 ring-1 ring-inset ring-primary'
          : 'hover:bg-slate-50',
      )}
    >
      <Avatar className="h-7 w-7">
        <AvatarImage src={profile.avatar_url ?? undefined} />
        <AvatarFallback className="bg-slate-100 text-meta font-semibold text-slate-600">
          {profile.full_name?.[0] ?? '?'}
        </AvatarFallback>
      </Avatar>
      <span className="text-subtitle font-medium text-slate-900 truncate flex-1">{profile.full_name}</span>
      {selected && <Check className="icon-md text-primary shrink-0" />}
    </button>
  );
}

// SelectionPill — pill gọn 1 dòng: stack + đếm + nút X.
// Có thể dùng cho cả PeoplePicker và DepartmentPicker.
export function SelectionPill({
  avatars, countLabel, onClear,
}: {
  avatars?: Pick<ProfileLike, 'id' | 'full_name' | 'avatar_url'>[];
  countLabel: string;
  onClear?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-primary/5 ring-1 ring-primary/20 rounded-full pl-2 pr-1 h-10">
      {avatars && avatars.length > 0 && (
        <AvatarStack people={avatars} max={5} size="sm" />
      )}
      <span className="text-subtitle font-semibold text-slate-900 flex-1 truncate pr-2">
        {countLabel}
      </span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Bỏ chọn tất cả"
          className="w-8 h-8 inline-flex items-center justify-center rounded-full text-slate-500 hover:bg-white/60 transition-colors"
        >
          <X className="icon-md" />
        </button>
      )}
    </div>
  );
}
