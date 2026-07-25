'use client'

import React from "react";
import { cn } from "@/lib/utils";

// PageHeader chuẩn dùng chung mọi trang. Bảo đảm tiêu đề và mô tả cùng size/spacing.
// Slot `action` để gắn nút primary (vd "Tạo mới") — chỉ hiển thị từ tablet trở lên.
// Trên mobile, nút tạo mới được chuyển sang FAB ở MobileCreateFab để tuân thủ HIG.

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <header className={cn(
      "flex flex-col gap-4 pt-4 sm:pt-0 sm:flex-row sm:items-end sm:justify-between",
      className
    )}>
      <div className="space-y-1">
        <h1 className="heading-page">{title}</h1>
        {description && <p className="text-subtitle">{description}</p>}
      </div>
      {action && <div className="hidden sm:block shrink-0">{action}</div>}
    </header>
  );
}
