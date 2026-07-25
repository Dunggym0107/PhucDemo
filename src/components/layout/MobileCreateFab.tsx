'use client'

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";

// Floating Action Button (FAB) cho tạo mới, contextual theo route.
// Theo HIG: chỉ hiển thị mobile (lg:hidden), nằm trên mobile bottom nav,
// kích thước 56pt (h-14), bo tròn full, shadow nổi bật.
// Tự ẩn khi có Dialog/Popover/Sheet mở (rule :has trong globals.css).
// Không hiển thị cho role 'admin' — admin = quản trị hệ thống, không tạo
// resource cấp chi nhánh.

type CreateAction =
  | { kind: 'link'; href: string }
  | { kind: 'param'; param?: string };

// Map route → hành động tạo mới tương ứng
const CREATE_ACTIONS: Record<string, CreateAction> = {
  '/dashboard/tasks':           { kind: 'param', param: 'create' },
  '/dashboard/tasks/recurring': { kind: 'param', param: 'create' },
  '/dashboard/schedule':        { kind: 'param', param: 'create' },
  '/dashboard/team':            { kind: 'param', param: 'create' },
  '/dashboard/handover':        { kind: 'param', param: 'create' },
};

export default function MobileCreateFab() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentProfile, hydrating } = useAppData();

  const action = CREATE_ACTIONS[pathname];
  if (!action) return null;
  // Chờ load profile xong rồi mới quyết định.
  if (hydrating && !currentProfile) return null;

  const handleClick = () => {
    if (action.kind === 'link') {
      router.push(action.href);
    } else {
      const params = new URLSearchParams(window.location.search);
      params.set(action.param || 'create', '1');
      router.replace(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Tạo mới"
      data-fab
      className="fab-shell lg:hidden"
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
