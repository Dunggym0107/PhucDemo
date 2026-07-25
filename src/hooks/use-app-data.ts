'use client'

import { createContext, useContext, useMemo } from 'react';
import type { Profile } from '@/types/profile';

// Chuyển interface và context sang đây để tránh duplicate module context trong Turbopack
export interface OutOfOfficeRecord {
 id: string;
 user_id: string;
 message: string;
 ends_at: string;
 created_at: string;
}

export interface AppDataValue {
 profiles: Profile[];
 currentProfile: Profile | null;
 departments: any[];
 outOfOffice: Record<string, OutOfOfficeRecord>;
 // Tài nguyên dùng chung (ít thay đổi — cache 24h, realtime invalidate):
 // - vehicles kèm default_driver join
 // - rooms (đơn thuần)
 vehicles: any[];
 rooms: any[];
 hydrating: boolean;
 refresh: () => Promise<void>;
}

export const AppDataContext = createContext<AppDataValue | null>(null);

export function useAppData() {
 const ctx = useContext(AppDataContext);
 if (!ctx) {
 throw new Error('useAppData phải nằm bên trong <AppDataProvider /> (dashboard layout).');
 }
 return ctx;
}

// Tiện ích: tìm profile theo id (memo theo profiles array để tránh map lại mỗi render)
export function useProfileLookup() {
 const { profiles } = useAppData();
 return useMemo(() => {
 const map = new Map<string, Profile>();
 profiles.forEach((p) => map.set(p.id, p));
 return map;
 }, [profiles]);
}
