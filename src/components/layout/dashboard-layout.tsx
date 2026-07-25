'use client'

import React, { useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
 LayoutDashboard,
 Users,
 ListTodo,
 SlidersHorizontal,
 LogOut,
 CalendarDays,
 FolderOpen,
 Search
} from "lucide-react";
import { cn, getProfileDisplayTitle } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
 DropdownMenuRadioGroup,
 DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/utils/supabase/client";
import { flushCache } from "@/lib/local-cache";
import { useAppData } from "@/hooks/use-app-data";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { canManageResourceCatalog } from "@/lib/permissions";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { BatchScopeDialogProvider } from "@/components/ui/batch-scope-dialog";
import DesktopSidebar from "./DesktopSidebar";
import MobileBottomNav from "./MobileBottomNav";
import MobileCreateFab from "./MobileCreateFab";

interface DashboardLayoutProps {
 children: React.ReactNode;
 profile: any;
}


function TopNavActionsContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Define configurations for pages that need search/filter
  const configMap: Record<string, { placeholder: string, hasStatusFilter?: boolean }> = {
    '/dashboard/team': { placeholder: 'Tìm kiếm cán bộ, phòng ban...' },
    '/dashboard/tasks': { placeholder: 'Tìm kiếm công việc...', hasStatusFilter: true },
    '/dashboard/handover': { placeholder: 'Tìm mã hồ sơ, tiêu đề, khách hàng...', hasStatusFilter: true },
    '/dashboard/admin': { placeholder: 'Tìm kiếm tài khoản, dữ liệu...' },
    '/dashboard/settings/users': { placeholder: 'Tìm kiếm người dùng...' },
  };

  const config = configMap[pathname];
  if (!config || !isMounted) return null;

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || 'all';
  const isFiltering = status !== 'all';

  const handleSearch = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set('q', val);
    else params.delete('q');
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleStatusFilter = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val !== 'all') params.set('status', val);
    else params.delete('status');
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-end lg:justify-center flex-1 gap-2 w-full min-w-0">
      {/* Desktop View */}
      <div className="hidden lg:flex items-center gap-3 w-full">
        <div className="relative flex-1 group transition-all duration-300">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 icon-md text-slate-500 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder={config.placeholder}
            className="pl-10"
            defaultValue={q}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        
        {/* Bộ lọc trạng thái — Button + DropdownMenu để khớp 100% style với Bell */}
        {config.hasStatusFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-11 w-11 rounded-full hover:bg-slate-100 transition-all shrink-0"
                aria-label={isFiltering ? "Bộ lọc đang được áp dụng" : "Mở bộ lọc"}
              >
                <SlidersHorizontal className={cn("h-5 w-5", isFiltering ? "text-amber-700" : "text-slate-600")} />
                {isFiltering && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border border-slate-100 shadow-premium">
              <DropdownMenuRadioGroup value={status} onValueChange={handleStatusFilter}>
                <DropdownMenuRadioItem value="all" className="rounded-lg font-medium">Tất cả trạng thái</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="overdue" className="rounded-lg font-medium">Quá hạn</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="todo" className="rounded-lg font-medium">Chưa làm</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="doing" className="rounded-lg font-medium">Đang làm</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="submitted" className="rounded-lg font-medium">Đã nộp</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="done" className="rounded-lg font-medium">Hoàn thành</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Mobile View */}
      <div className="flex items-center gap-1 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-full shrink-0 hover:bg-slate-100 transition-all"
          onClick={() => setIsMobileSearchOpen(true)}
          aria-label="Mở tìm kiếm"
        >
          <Search className="h-5 w-5 text-slate-600" />
        </Button>

        {config.hasStatusFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-11 w-11 rounded-full hover:bg-slate-100 transition-all shrink-0"
                aria-label={isFiltering ? "Bộ lọc đang được áp dụng" : "Mở bộ lọc"}
              >
                <SlidersHorizontal className={cn("h-5 w-5", isFiltering ? "text-amber-700" : "text-slate-600")} />
                {isFiltering && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border border-slate-100 shadow-premium">
              <DropdownMenuRadioGroup value={status} onValueChange={handleStatusFilter}>
                <DropdownMenuRadioItem value="all" className="rounded-lg font-medium">Tất cả trạng thái</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="overdue" className="rounded-lg font-medium">Quá hạn</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="todo" className="rounded-lg font-medium">Chưa làm</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="doing" className="rounded-lg font-medium">Đang làm</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="submitted" className="rounded-lg font-medium">Đã nộp</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="done" className="rounded-lg font-medium">Hoàn thành</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Mobile Search Overlay */}
      {isMobileSearchOpen && (
        <div className="fixed inset-x-0 top-0 h-[64px] bg-white/90 backdrop-blur-2xl z-[60] flex items-center px-3 gap-2 border-b border-slate-100 animate-in fade-in slide-in-from-top-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 icon-md text-slate-500" />
            <Input 
              autoFocus 
              placeholder={config.placeholder}
              className="pl-10"
              defaultValue={q}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          {config.hasStatusFilter && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-11 w-11 rounded-full hover:bg-slate-100 transition-all shrink-0"
                  aria-label={isFiltering ? "Bộ lọc đang được áp dụng" : "Mở bộ lọc"}
                >
                  <SlidersHorizontal className={cn("h-5 w-5", isFiltering ? "text-amber-700" : "text-slate-600")} />
                  {isFiltering && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl border border-slate-100 shadow-premium">
                <DropdownMenuRadioGroup value={status} onValueChange={handleStatusFilter}>
                  <DropdownMenuRadioItem value="all" className="rounded-lg font-medium">Tất cả trạng thái</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="overdue" className="rounded-lg font-medium">Quá hạn</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="todo" className="rounded-lg font-medium">Chưa làm</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="doing" className="rounded-lg font-medium">Đang làm</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="submitted" className="rounded-lg font-medium">Đã nộp</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="done" className="rounded-lg font-medium">Hoàn thành</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" className="shrink-0 text-slate-600 font-medium px-3 rounded-xl h-11" onClick={() => setIsMobileSearchOpen(false)}>
            Huỷ
          </Button>
        </div>
      )}
    </div>
  );
}

function TopNavActions() {
  return (
    <Suspense fallback={<div className="w-10 h-10" />}>
      <TopNavActionsContent />
    </Suspense>
  );
}

export function DashboardLayout({ children, profile }: DashboardLayoutProps) {
 const pathname = usePathname();
 const router = useRouter();
  const { currentProfile } = useAppData();
  // Avatar topnav phải reactive — sau khi user crop xong, context cập nhật ngay
  // Fallback về prop server-fetched nếu context chưa hydrate.
  const avatarUrl = currentProfile?.avatar_url ?? profile?.avatar_url;
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsScrolledDown(true);
      } else if (currentScrollY < lastScrollY) {
        setIsScrolledDown(false);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

React.useEffect(() => {
  setMounted(true);
}, []);

const handleLogout = async () => {
    setIsLogoutDialogOpen(false);
    flushCache();
    await supabase.auth.signOut();
    // Chuyển hướng cứng (Hard reload) để dọn sạch hoàn toàn các lớp phủ Dialog Portal Radix bị kẹt và session cũ
    window.location.href = '/login';
  };
  const canManageSystem = canManageResourceCatalog(profile);

  const navItems = [
   { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, prefetch: true },
   { name: 'Công việc', href: '/dashboard/tasks', icon: ListTodo, prefetch: true, hideFor: ['driver', 'secretary', 'hr_officer'] },
   { name: 'Lịch trình', href: '/dashboard/schedule', icon: CalendarDays, prefetch: true },
   { name: 'Hồ sơ', href: '/dashboard/handover', icon: FolderOpen, prefetch: true, hideFor: ['driver'] },
   { name: 'Cán bộ', href: '/dashboard/team', icon: Users, prefetch: true, hideFor: ['driver'] },
  ].filter(item => !(item.hideFor || []).includes(profile?.role));

 return (
  <>
  <div className="flex min-h-screen bg-background">
 <ConfirmDialogProvider />
 <BatchScopeDialogProvider />

 {/* Logout Confirmation Dialog (Shared) */}
 <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
 <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
 <AlertDialogHeader>
 <AlertDialogTitle className="text-xl font-bold tabular-nums">Xác nhận Đăng xuất?</AlertDialogTitle>
 <AlertDialogDescription className="text-slate-500">
 Bạn có chắc chắn muốn kết thúc phiên làm việc hiện tại không?
 </AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter className="mt-4 gap-3">
 <AlertDialogCancel className="rounded-xl h-11 border-slate-200">Hủy</AlertDialogCancel>
 <AlertDialogAction onClick={handleLogout} className="rounded-xl h-11 bg-red-600 hover:bg-red-700 font-bold px-6">
 Đăng xuất ngay
 </AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>

 {/* Sidebar Desktop */}
 <DesktopSidebar
   navItems={navItems}
   pathname={pathname}
   canManageSystem={canManageSystem}
   profile={profile}
   onLogout={() => setIsLogoutDialogOpen(true)}
 />

 <div className="flex-1 flex flex-col min-w-0">
 <header className={cn(
    "h-[60px] lg:h-16 bg-white/80 backdrop-blur-md border border-slate-100 sticky top-safe lg:top-4 z-40 flex items-center px-3 lg:px-8 mx-0 lg:mx-8 mt-safe lg:mt-4 rounded-none lg:rounded-2xl shadow-sm lg:border-x lg:border-t border-x-0 border-t-0 transition-transform duration-300 ease-in-out gap-4",
    isScrolledDown ? "-translate-y-full lg:translate-y-0" : "translate-y-0"
  )}>
    {/* Left + Middle: Search & Filter (full width, không còn lặp tiêu đề trang) */}
    <div className="flex items-center flex-1 z-20 min-w-0">
      <TopNavActions />
    </div>

    {/* Right: Notifications & Profile */}
    <div className="flex items-center justify-end gap-3 lg:gap-5 relative z-10 shrink-0">
  <NotificationsDropdown />
 
 <div className="hidden sm:flex flex-col text-right">
 <span className="text-sm font-bold text-slate-900 leading-none">
 {profile?.full_name || 'Cán bộ'}
 </span>
  <span className="text-sm font-medium text-primary mt-1.5 truncate whitespace-nowrap">
  {getProfileDisplayTitle(profile)}
  </span>
 </div>

 {mounted ? (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full p-0" aria-label="Mở menu tài khoản">
 <Avatar className="h-11 w-11 border-2 border-white shadow-sm cursor-pointer hover:scale-[1.02] transition-transform">
 <AvatarImage src={avatarUrl} className="object-cover" />
 <AvatarFallback className="bg-primary text-primary-foreground font-bold">{profile?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent className="w-56 mt-2 rounded-xl" align="end">
 <DropdownMenuLabel>Tài khoản của tôi</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard/profile')}>Hồ sơ cá nhân</DropdownMenuItem>
 <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard/settings')}>Cài đặt</DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem className="text-red-500 font-bold cursor-pointer" onClick={() => setIsLogoutDialogOpen(true)}>
 <LogOut className="w-4 h-4 mr-2" /> Đăng xuất
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 ) : (
 <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
 <AvatarImage src={avatarUrl} className="object-cover" />
 <AvatarFallback className="bg-primary text-primary-foreground font-bold">{profile?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 )}
 </div>
 </header>

 <main
 className="relative flex-1 max-w-full overflow-x-hidden p-4 pb-mobile-nav lg:p-8"
 >
 {children}
 </main>
 </div>
 </div>
 <MobileBottomNav navItems={navItems} pathname={pathname} />
 <MobileCreateFab />
 </>
 );
}
