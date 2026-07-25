'use client'

import React, { useState, useEffect } from "react";
import { Bell, Loader2, Inbox, Zap, Calendar, Target, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { notifySuccess } from "@/lib/notify";
import { useAppData } from "@/hooks/use-app-data";

export function NotificationsDropdown() {
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();
  const router = useRouter();
  const { currentProfile } = useAppData();

  useEffect(() => {
    setMounted(true);

    let active = true;
    let channel: any;

    const setupNotifications = () => {
      const userId = currentProfile?.id;
      if (!userId || !active) return;

      fetchNotifications(userId);

      // Khởi tạo channel và đăng ký sự kiện Trước khi subscribe
      channel = supabase
        .channel(`notifications_realtime_${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        }, (payload: any) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);
          notifySuccess(payload.new.title, payload.new.content);
        });

      channel.subscribe();
    };

    if (currentProfile) {
      setupNotifications();
    }

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, currentProfile]);

  const fetchNotifications = async (userId: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      setNotifications(data || []);
      setUnreadCount(data?.filter((n: any) => !n.is_read).length || 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
    }
  };

  const markAllAsRead = async () => {
    const userId = currentProfile?.id;
    if (!userId) return;
    try {
      // Cập nhật tất cả thông báo chưa đọc của user thành đã đọc bằng 1 request duy nhất
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      // Đồng bộ state local ngay lập tức
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Lỗi khi đánh dấu đọc tất cả thông báo:", error);
    }
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const getNotificationIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('hỏa tốc') || t.includes('nhắc') || t.includes('khẩn cấp')) {
      return (
        <span className="p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 fill-current" />
        </span>
      );
    }
    if (t.includes('lịch trình') || t.includes('xe') || t.includes('phòng họp')) {
      return (
        <span className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0 flex items-center justify-center">
          <Calendar className="w-3.5 h-3.5" />
        </span>
      );
    }
    if (t.includes('chỉ tiêu') || t.includes('khen') || t.includes('hoàn thành')) {
      return (
        <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0 flex items-center justify-center">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </span>
      );
    }
    return (
      <span className="p-2 bg-slate-50 text-slate-600 rounded-xl shrink-0 flex items-center justify-center">
        <Bell className="w-3.5 h-3.5" />
      </span>
    );
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-full" aria-label="Mở thông báo">
        <Bell className="h-5 w-5 text-slate-600" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-full hover:bg-slate-100 transition-all" aria-label={unreadCount > 0 ? `Mở thông báo, có ${unreadCount} thông báo chưa đọc` : "Mở thông báo"}>
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 !flex !h-5 !min-h-5 !w-5 !min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 !p-0 text-[10px] font-bold leading-none text-white tabular-nums">
              {unreadCount > 9 ? (
                <span className="flex items-center justify-center translate-x-[0.5px]">
                  9<span className="text-[7.5px] -ml-[0.5px] mt-[1px]">+</span>
                </span>
              ) : (
                unreadCount
              )}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        alignOffset={-8}
        collisionPadding={16}
        className="w-[calc(100vw-32px)] sm:w-[380px] p-2 rounded-2xl shadow-xl border-slate-100 mt-2 bg-white"
      >
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100 mb-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-slate-800">Thông báo hệ thống</span>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              className="h-auto p-0 text-sm font-medium text-primary hover:bg-transparent truncate whitespace-nowrap"
              onClick={markAllAsRead}
            >
              Đọc tất cả
            </Button>
          )}
        </div>

        <div className="max-h-[70vh] sm:max-h-[420px] overflow-y-auto overscroll-contain">
        <div className="space-y-1.5 pr-1">
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
          ) : notifications.length > 0 ? (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "cursor-pointer rounded-xl p-3 !pl-4 border-y border-r border-slate-100/60 shadow-sm flex gap-3 relative overflow-hidden transition-all mb-1.5 focus:bg-slate-50/80 focus:text-inherit select-none",
                  !n.is_read
                    ? "bg-gradient-to-r from-blue-50/20 to-white border-l-4 border-l-blue-600"
                    : "bg-white border-l-4 border-l-slate-200"
                )}
              >
                {getNotificationIcon(n.title)}

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className={cn(
                      "text-sm font-medium leading-tight truncate flex-1",
                      !n.is_read ? "text-blue-900" : "text-slate-800"
                    )}>
                      {n.title}
                    </span>
                    {!n.is_read && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-0.5 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-semibold">
                    {n.content}
                  </p>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-slate-500 font-bold">
                      {new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[11px] text-slate-300">•</span>
                    <span className="text-[11px] text-primary/60 font-bold">Hệ thống</span>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="py-10 text-center item-stack">
              <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Inbox className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-500 truncate whitespace-nowrap">Hộp thư trống</p>
            </div>
          )}
        </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
