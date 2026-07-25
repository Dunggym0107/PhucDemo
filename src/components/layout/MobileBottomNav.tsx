'use client'

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: string;
  icon: any;
}

interface Props {
  navItems: NavItem[];
  pathname: string;
}

// Mobile tab bar theo phong cách iOS 26 "Liquid Glass":
//   - Floating bar (cách 2 cạnh trái/phải bằng mx-3), không edge-to-edge
//   - Frosted glass: backdrop-blur-2xl + saturate cho nền trong suốt sống động
//   - Active state KHÔNG dùng background pill (đúng iOS) — chỉ tint màu primary,
//     icon tăng nét (strokeWidth 2.6), label đậm hơn
//   - Inactive: slate-500, strokeWidth 2
//   - Icon size 26px (chuẩn iOS tab bar), label 11px (caption)
//   - Truncate-safe: container full width của nav, không max-w cố định
export default function MobileBottomNav({ navItems, pathname }: Props) {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="lg:hidden fixed inset-x-0 z-50 flex justify-center pointer-events-none bottom-safe"
    >
      <div
        className={cn(
          "pointer-events-auto",
          // Container full width trừ margin 2 cạnh
          // mx-2 thay vì mx-3 để có thêm ~8px ngang, đủ chỗ cho "Lịch trình" 10 ký tự
          "mx-2 w-full",
          // Liquid glass surface
          "rounded-[28px] border border-white/40",
          "bg-white/65 backdrop-blur-2xl backdrop-saturate-150",
          "shadow-[0_8px_32px_-8px_rgba(15,23,42,0.18),0_2px_8px_-2px_rgba(15,23,42,0.08)]",
          // Padding nội bộ vừa đủ
          "px-1 py-1.5"
        )}
      >
        <div
          className="grid gap-0"
          style={{ gridTemplateColumns: `repeat(${Math.min(navItems.length, 5)}, minmax(0, 1fr))` }}
        >
          {navItems.slice(0, 5).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.name}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-2xl px-0.5",
                  "transition-all duration-150 ease-out",
                  "active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  isActive ? "text-primary" : "text-slate-500"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[26px] w-[26px] shrink-0 transition-transform",
                    isActive && "scale-[1.04]"
                  )}
                  strokeWidth={isActive ? 2.6 : 2}
                />
                <span
                  className={cn(
                    "max-w-full truncate leading-none text-[11px]",
                    isActive ? "font-bold" : "font-medium"
                  )}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
