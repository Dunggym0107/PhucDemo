'use client';

import React, { useMemo } from 'react';
import { Building2, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sortProfilesByHierarchy } from '@/lib/utils';
import { filterBGD, filterStaff, resolveParticipantIds } from '../_lib/utils';
import { PeoplePicker, SelectionPill } from '@/components/ui/people-picker';
import { DepartmentPicker } from '@/components/ui/department-picker';

interface Props {
  allProfiles: any[];
  departments: any[];
  bgdMode: 'all' | 'specific' | 'none';
  setBgdMode: (v: 'all' | 'specific' | 'none') => void;
  selectedBGD: string[];
  setSelectedBGD: (v: string[]) => void;
  deptMode: 'all' | 'specific' | 'none';
  setDeptMode: (v: 'all' | 'specific' | 'none') => void;
  filterDepts: string[];
  setFilterDepts: (v: string[]) => void;
  participantMode: 'all' | 'manager' | 'staff';
  setParticipantMode: (v: 'all' | 'manager' | 'staff') => void;
  selectedParticipants: string[];
  setSelectedParticipants: (v: string[]) => void;
}

export default function ParticipantSelector({
  allProfiles, departments,
  bgdMode, setBgdMode, selectedBGD, setSelectedBGD,
  deptMode, setDeptMode, filterDepts, setFilterDepts,
  participantMode, setParticipantMode,
  selectedParticipants, setSelectedParticipants,
}: Props) {
  const bgdProfiles = useMemo(() => filterBGD(allProfiles), [allProfiles]);

  // Cán bộ pool theo phòng đã chọn — fed vào PeoplePicker khi participantMode='staff'
  const staffPool = useMemo(() => {
    if (deptMode !== 'specific' || filterDepts.length === 0) return [];
    return filterStaff(allProfiles).filter(p => filterDepts.includes(p.department_id));
  }, [allProfiles, deptMode, filterDepts]);

  const finalSelectedIds = useMemo(() => resolveParticipantIds({
    selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles,
  }), [selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles]);

  const finalProfiles = useMemo(() => sortProfilesByHierarchy(
    allProfiles.filter(p => finalSelectedIds.includes(p.id)),
  ), [allProfiles, finalSelectedIds]);

  const departmentItems = useMemo(
    () => departments.map(d => ({ id: d.id, name: d.name, code: d.code })),
    [departments],
  );

  const clearAll = () => {
    setBgdMode('none'); setSelectedBGD([]);
    setDeptMode('none'); setFilterDepts([]);
    setParticipantMode('staff'); setSelectedParticipants([]);
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5 group-stack">
      <div className="flex items-center gap-2">
        <Users className="icon-sm text-primary" />
        <Label className="heading-card">Thành phần tham gia</Label>
        <Badge className="ml-auto border-none bg-primary/10 px-2 py-0.5 text-meta font-medium text-primary">
          {finalProfiles.length > 0 ? `${finalProfiles.length} người` : 'Chưa chọn ai'}
        </Badge>
      </div>

      {/* BGĐ */}
      <section className="item-stack">
        <Label className="flex items-center gap-1.5 text-label">
          <ShieldCheck className="icon-sm text-red-500" />
          Ban Giám đốc
        </Label>
        <Tabs value={bgdMode} onValueChange={(v) => {
          const mode = v as 'all' | 'specific' | 'none';
          setBgdMode(mode);
          if (mode !== 'specific') setSelectedBGD([]);
        }}>
          <TabsList className="grid w-full grid-cols-3 min-h-10">
            <TabsTrigger value="all" className="rounded-md text-meta font-medium">Tất cả</TabsTrigger>
            <TabsTrigger value="specific" className="rounded-md text-meta font-medium">Chọn</TabsTrigger>
            <TabsTrigger value="none" className="rounded-md text-meta font-medium">Không</TabsTrigger>
          </TabsList>
        </Tabs>
        {bgdMode === 'all' && (
          <p className="text-meta italic">Tự động mời toàn bộ Ban Giám đốc.</p>
        )}
        {bgdMode === 'specific' && (
          <PeoplePicker
            profiles={bgdProfiles}
            selected={selectedBGD}
            onChange={setSelectedBGD}
            mode="multiple"
            defaultOpenGroup="bgd"
          />
        )}
      </section>

      {/* Phòng ban */}
      <section className="item-stack">
        <Label className="flex items-center gap-1.5 text-label">
          <Building2 className="icon-sm text-blue-500" />
          Phòng ban
        </Label>
        <Tabs value={deptMode} onValueChange={(v) => {
          const mode = v as 'all' | 'specific' | 'none';
          setDeptMode(mode);
          if (mode !== 'specific') setFilterDepts([]);
          if (mode === 'none') setSelectedParticipants([]);
        }}>
          <TabsList className="grid w-full grid-cols-3 min-h-10">
            <TabsTrigger value="all" className="rounded-md text-meta font-medium">Tất cả</TabsTrigger>
            <TabsTrigger value="specific" className="rounded-md text-meta font-medium">Chọn</TabsTrigger>
            <TabsTrigger value="none" className="rounded-md text-meta font-medium">Không</TabsTrigger>
          </TabsList>
        </Tabs>
        {deptMode === 'all' && (
          <p className="text-meta italic">Tự động mời mọi cán bộ toàn chi nhánh.</p>
        )}
        {deptMode === 'specific' && (
          <DepartmentPicker
            items={departmentItems}
            selected={filterDepts}
            onChange={setFilterDepts}
            triggerLabel="Chọn phòng ban"
          />
        )}
      </section>

      {/* Cán bộ — phụ thuộc Phòng */}
      {deptMode === 'specific' && filterDepts.length > 0 && (
        <section className="item-stack">
          <Label className="flex items-center gap-1.5 text-label">
            <UserCheck className="icon-sm text-emerald-500" />
            Cán bộ trong phòng đã chọn
          </Label>
          <Tabs value={participantMode} onValueChange={(v) => {
            const mode = v as 'all' | 'manager' | 'staff';
            setParticipantMode(mode);
            if (mode !== 'staff') setSelectedParticipants([]);
          }}>
            <TabsList className="grid w-full grid-cols-3 min-h-10">
              <TabsTrigger value="all" className="rounded-md text-meta font-medium">Tất cả</TabsTrigger>
              <TabsTrigger value="manager" className="rounded-md text-meta font-medium">Lãnh đạo</TabsTrigger>
              <TabsTrigger value="staff" className="rounded-md text-meta font-medium">Chọn</TabsTrigger>
            </TabsList>
          </Tabs>
          {participantMode === 'all' && (
            <p className="text-meta italic">Tự động mời toàn bộ cán bộ thuộc các phòng đã chọn.</p>
          )}
          {participantMode === 'manager' && (
            <p className="text-meta italic">Tự động mời lãnh đạo các phòng đã chọn.</p>
          )}
          {participantMode === 'staff' && (
            <PeoplePicker
              profiles={staffPool}
              selected={selectedParticipants}
              onChange={setSelectedParticipants}
              mode="multiple"
            />
          )}
        </section>
      )}

      {/* Tổng kết — pill gọn ở cuối */}
      {finalProfiles.length > 0 && (
        <SelectionPill
          avatars={finalProfiles}
          countLabel={`${finalProfiles.length} người sẽ được mời`}
          onClear={clearAll}
        />
      )}
    </div>
  );
}
