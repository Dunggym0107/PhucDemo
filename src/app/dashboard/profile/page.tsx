'use client'

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Mail, Camera, Loader2, LogOut, History, Phone, Calendar,
  Briefcase, Pencil, CheckCircle2, Cake, IdCard, UserCog,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { notifyError, notifySuccess } from "@/lib/notify";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { viLocale as vi } from "@/lib/locale";
import PageHeader from "@/components/layout/PageHeader";
import AvatarCropDialog from "@/components/ui/avatar-crop-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useAppData } from "@/hooks/use-app-data";
import { ROLE_LABELS, STATUS_BADGES } from "../team/_lib/constants";
import { getProfileBadgeStatus, getYearsOfService } from "../team/_lib/utils";
import EditProfileDialog from "../team/_components/EditProfileDialog";
import { Skeleton } from "@/components/ui/skeleton";

// Trang hồ sơ cá nhân — đồng bộ pattern với ProfileDetailDialog (team module).
export default function ProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { currentProfile, outOfOffice, refresh } = useAppData();
  const [profile, setProfile] = useState<any>(currentProfile);
  const [loading, setLoading] = useState(!currentProfile);
  const [uploading, setUploading] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OOO của user hiện tại — lấy từ cache shared
  const ooo = currentProfile ? outOfOffice[currentProfile.id] ?? null : null;

  useEffect(() => {
    if (currentProfile) {
      setProfile(currentProfile);
    }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile?.id]);

  const loadAll = async () => {
    if (!currentProfile) return;
    if (!profile) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayIso = new Date().toISOString();
      // Fetch profile trực tiếp từ DB — không dùng currentProfile từ context vì
      // sau khi save EditProfileDialog, context có thể chưa cập nhật xong khi
      // onSaved fire → tránh ghi data cũ vào local state.
      const [profileRes, activityRes, scheduleRes] = await Promise.all([
        supabase.from('profiles').select('*, departments(*)').eq('id', user.id).maybeSingle(),
        supabase.from('task_comments').select('*, task:tasks(title)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('schedules').select('id, type, status, start_time, end_time, created_by').eq('created_by', user.id).lte('start_time', todayIso).gte('end_time', todayIso),
      ]);
      const fresh = profileRes.data ?? currentProfile;
      setProfile({ ...fresh, email: user.email });
      setActivities(activityRes.data ?? []);
      setTodaySchedules(scheduleRes.data ?? []);
    } catch (error) {
      notifyError(error, "Không tải được hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCropFile(file);
    setCropOpen(true);
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!profile?.id) return;
    setUploading(true);
    try {
      const path = `${profile.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
        upsert: true,
        contentType: 'image/jpeg',
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const busted = `${data.publicUrl}?v=${Date.now()}`;
      // .select() để phát hiện RLS chặn (0 row affected không return error).
      const { data: updated, error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: busted })
        .eq('id', profile.id)
        .select('id')
        .maybeSingle();
      if (updErr) throw updErr;
      if (!updated) throw new Error('Không có quyền cập nhật avatar (RLS chặn)');
      setProfile((p: any) => ({ ...p, avatar_url: busted }));
      // Await refresh để cache shared (sidebar/topnav/danh bạ) cập nhật trước khi tiếp tục
      await refresh();
      notifySuccess("Đã cập nhật ảnh đại diện");
    } catch (error) {
      notifyError(error, "Không tải lên được ảnh");
    } finally {
      setUploading(false);
      setCropFile(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container space-y-6 md:section-stack motion-safe:animate-fade-in-up">
        <PageHeader title="Hồ sơ cá nhân" description="Thông tin tài khoản và thông tin hiển thị trong danh bạ Nhân sự" />
        
        {/* Hero card skeleton */}
        <section className="premium-card !p-0 overflow-hidden bg-slate-50/60">
          <div className="px-[var(--app-page-x)] py-5 sm:py-6 flex items-start gap-3 sm:gap-4">
            <Skeleton className="h-16 w-16 sm:h-20 sm:w-20 rounded-full shrink-0 animate-pulse" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48 rounded animate-pulse" />
              <Skeleton className="h-4 w-32 rounded animate-pulse" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-5 w-16 rounded-md animate-pulse" />
                <Skeleton className="h-5 w-20 rounded-md animate-pulse" />
              </div>
            </div>
          </div>
        </section>

        {/* 2 info sections skeleton */}
        <div className="group-stack">
          {Array.from({ length: 2 }).map((_, i) => (
            <section key={i} className="premium-card p-4 sm:p-5 item-stack">
              <Skeleton className="h-5 w-40 rounded animate-pulse" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 py-2.5">
                  <Skeleton className="h-5 w-5 rounded shrink-0 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-20 rounded animate-pulse" />
                    <Skeleton className="h-4 w-2/3 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    );
  }
  if (!profile) return null;

  const status = getProfileBadgeStatus(profile, todaySchedules, ooo, new Date());
  const role = ROLE_LABELS[profile.role] ?? ROLE_LABELS.staff;
  const statusMeta = STATUS_BADGES[status];
  const years = getYearsOfService(profile.branch_join_date);
  const deptName = profile.departments?.name ?? null;
  // Email: legacy lưu username (không có @), mới user tự nhập đầy đủ. Fallback auth email nếu rỗng.
  const emailAddress = profile.ad_account
    ? (profile.ad_account.includes('@') ? profile.ad_account : `${profile.ad_account}@vietinbank.vn`)
    : (profile.email ?? null);
  const mailto = emailAddress ? `mailto:${emailAddress}` : null;

  const heroBg = (() => {
    if (status === 'on_leave') return 'bg-amber-50/50';
    if (status === 'on_trip') return 'bg-sky-50/50';

    if (status === 'new_joiner') return 'bg-emerald-50/50';
    return 'bg-slate-50/60';
  })();

  return (
    <div className="page-container space-y-6 md:section-stack motion-safe:animate-fade-in-up">
      <PageHeader
        title="Hồ sơ cá nhân"
        description="Thông tin tài khoản và thông tin hiển thị trong danh bạ Nhân sự"
        action={
          <Button
            variant="ghost"
            onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
            className="min-h-11 rounded-xl px-5 font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all"
          >
            <LogOut className="icon-sm mr-2" />
            Đăng xuất
          </Button>
        }
      />

      {/* HERO — đồng bộ ProfileDetailDialog: nền nhẹ theo trạng thái, không noise */}
      <section className={cn("premium-card !p-0 overflow-hidden", heroBg)}>
        <div className="px-[var(--app-page-x)] py-5 sm:py-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div
              className="relative shrink-0 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-full"
              role="button"
              tabIndex={0}
              aria-label="Cập nhật ảnh đại diện"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-white shadow-sm">
                <AvatarImage src={profile.avatar_url} className="object-cover" />
                <AvatarFallback className="bg-primary text-white text-xl font-bold">{profile.full_name?.[0]}</AvatarFallback>
              </Avatar>
              <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white", statusMeta.dotColor)} />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? <Loader2 className="icon-sm text-white animate-spin" /> : <Camera className="icon-sm text-white" />}
              </div>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarPicked}
                disabled={uploading}
              />
            </div>

            <div className="flex-1 min-w-0 item-stack !gap-1">
              <h1 className="heading-section break-words">{profile.full_name}</h1>
              {profile.title && <p className="text-label truncate">{profile.title}</p>}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <Badge className={cn("font-bold rounded-md border-none", role.color)}>{role.label}</Badge>
                {status !== 'available' && (
                  <Badge className={cn("font-bold rounded-md border", statusMeta.chipClass)}>{statusMeta.label}</Badge>
                )}
              </div>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white shrink-0"
              onClick={() => setEditOpen(true)}
              aria-label="Sửa hồ sơ"
            >
              <Pencil className="icon-sm" />
            </Button>
          </div>
        </div>
      </section>

      {/* OOO active banner */}
      {ooo && new Date(ooo.ends_at) > new Date() && (
        <section className="rounded-2xl status-warning-bg border border-amber-200 p-4 item-stack">
          <p className="heading-card text-amber-900">📍 Bạn đang bật chế độ vắng mặt</p>
          <p className="text-label !text-amber-900 leading-snug">{ooo.message}</p>
          <p className="text-meta !text-amber-700">
            Đến {format(new Date(ooo.ends_at), "EEEE, dd/MM/yyyy HH:mm", { locale: vi })}
          </p>
        </section>
      )}

      <div className="group-stack">
        {/* CONTACT — thông tin hiển thị trong danh bạ Nhân sự */}
        <section className="premium-card p-4 sm:p-5 item-stack">
          <h2 className="heading-card">Thông tin liên hệ</h2>
            <div className="flex flex-col">
              <ContactRow
                icon={Briefcase}
                label="Phòng ban"
                value={deptName ?? '—'}
              />
              <ContactRow
                icon={Mail}
                label="Email"
                value={emailAddress ?? '—'}
                href={mailto ?? undefined}
                accent={!!mailto}
                valueClassName="truncate"
              />
              <ContactRow
                icon={Phone}
                label="Số di động"
                value={profile.phone ?? '—'}
                href={profile.phone ? `tel:${profile.phone}` : undefined}
                accent={!!profile.phone}
              />
              <ContactRow
                icon={Calendar}
                label="Vào chi nhánh"
                value={profile.branch_join_date
                  ? `${format(new Date(profile.branch_join_date), "dd/MM/yyyy", { locale: vi })}${years !== null ? ` · ${years} năm` : ''}`
                  : '—'}
                last
              />
            </div>
          </section>

          {/* SENSITIVE — thông tin nhân sự (chỉ self thấy ở đây) */}
          <section className="premium-card p-4 sm:p-5 item-stack">
          <h2 className="heading-card">Thông tin nhân sự</h2>
            <div className="flex flex-col">
              <ContactRow
                icon={Cake}
                label="Ngày sinh"
                value={profile.birthday
                  ? format(new Date(profile.birthday), "dd/MM/yyyy", { locale: vi })
                  : '—'}
              />
              <ContactRow
                icon={UserCog}
                label="Giới tính"
                value={profile.gender === 'male' ? 'Nam' : profile.gender === 'female' ? 'Nữ' : profile.gender === 'other' ? 'Khác' : '—'}
              />
              <ContactRow
                icon={IdCard}
                label="Mã CBNV"
                value={profile.employee_code ?? '—'}
              />
              <ContactRow
                icon={Mail}
                label="AD account"
                value={profile.ad_account ?? '—'}
                last
              />
            </div>
          </section>

          {/* ACTIVITY */}
          <section className="premium-card p-4 sm:p-5 item-stack">
            <h2 className="heading-card flex items-center gap-2">
              <History className="icon-sm text-slate-500" /> Hoạt động gần đây
            </h2>
            {activities.length > 0 ? (
              <div className="flex flex-col">
                {activities.map((act, idx) => (
                  <div
                    key={act.id}
                    className={cn(
                      "flex items-start gap-3 min-h-11 py-2.5",
                      idx !== activities.length - 1 && "border-b border-slate-100",
                    )}
                  >
                    <CheckCircle2 className="icon-sm text-emerald-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 item-stack !gap-0.5">
                      <p className="text-label !text-slate-900 truncate">
                        Phản hồi tại: <span className="font-semibold">{act.task?.title ?? '—'}</span>
                      </p>
                      <p className="text-meta tabular-nums">
                        {new Date(act.created_at).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<History className="icon-lg" />}
                title="Chưa có hoạt động nào"
                description="Bạn chưa có hoạt động nào được ghi nhận."
                variant="subtle"
              />
            )}
          </section>
      </div>

      {/* Edit dialog — viewer === target → self mode (phone/extension/seat_location/avatar + opt-out) */}
      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        target={profile}
        viewer={profile}
        onSaved={loadAll}
      />

      <AvatarCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        file={cropFile}
        onCropped={handleCroppedUpload}
      />
    </div>
  );
}

function ContactRow({
  icon: Icon, label, value, href, accent, last, valueClassName,
}: {
  icon: any; label: string; value: string; href?: string;
  accent?: boolean; last?: boolean; valueClassName?: string;
}) {
  const inner = (
    <div className={cn(
      "flex items-center gap-3 min-h-11 py-2.5",
      !last && "border-b border-slate-100",
    )}>
      <Icon className={cn("icon-sm shrink-0", accent ? "text-primary" : "text-slate-500")} />
      <div className="flex-1 min-w-0 item-stack !gap-0.5">
        <span className="text-meta">{label}</span>
        <span className={cn("text-label !text-slate-900 font-semibold", valueClassName)}>{value}</span>
      </div>
      {href && <ChevronRight className="icon-sm text-slate-300 shrink-0" />}
    </div>
  );
  if (href) {
    return (
      <a
        href={href}
        className="block transition-colors hover:bg-slate-50/60 active:bg-slate-100/60"
      >
        {inner}
      </a>
    );
  }
  return inner;
}
