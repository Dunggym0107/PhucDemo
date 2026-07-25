'use client'

import React from "react";
import { Bell, Lock, ChevronRight, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { notifyError, notifySuccess } from "@/lib/notify";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { createClient } from "@/utils/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import ChangePasswordDialog from "./_components/ChangePasswordDialog";

export default function SettingsPage() {
  const { subscription, subscribe, unsubscribe } = usePushSubscription();
  const [profileId, setProfileId] = React.useState<string | undefined>();
  const [mustChange, setMustChange] = React.useState(false);
  const [pwOpen, setPwOpen] = React.useState(false);
  const supabase = React.useMemo(() => createClient(), []);

  React.useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setProfileId(user.id);
      const { data } = await supabase.from('profiles').select('must_change_password').eq('id', user.id).single();
      setMustChange(!!data?.must_change_password);
    })();
  }, [supabase]);

  const togglePush = async (v: boolean) => {
    if (v) {
      try {
        const sub = await subscribe();
        if (sub) notifySuccess("Đã bật thông báo đẩy");
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg === 'IOS_NOT_STANDALONE') {
          notifyError(null, "Trên iOS cần 'Thêm vào màn hình chính' trước khi bật thông báo đẩy.");
        } else if (msg === 'IOS_VERSION_TOO_OLD') {
          notifyError(null, "iOS cần phiên bản 16.4 trở lên để hỗ trợ thông báo đẩy trên PWA.");
        } else {
          notifyError(null, "Hãy 'Thêm vào màn hình chính' và cấp quyền thông báo trước.");
        }
      }
    } else {
      await unsubscribe();
      notifySuccess("Đã tắt thông báo đẩy");
    }
  };

  return (
    <div className="page-container space-y-6 md:section-stack motion-safe:animate-fade-in-up">
      <PageHeader title="Cài đặt" description="Thông báo và bảo mật tài khoản" />

      <section className="premium-card item-stack">
        <h4 className="heading-card flex items-center gap-2">
          <Bell className="icon-sm text-slate-500" /> Thông báo
        </h4>
        <div className="flex items-center justify-between min-h-11">
          <div className="min-w-0 item-stack !gap-1">
            <p className="text-label !text-slate-900 font-semibold">Thông báo đẩy</p>
            <p className="text-meta">Nhận thông báo tức thời trên thiết bị</p>
          </div>
          <Switch checked={!!subscription} onCheckedChange={togglePush} />
        </div>
      </section>

      <section className="premium-card item-stack">
        <h4 className="heading-card flex items-center gap-2">
          <Lock className="icon-sm text-slate-500" /> Bảo mật
        </h4>
        <button
          type="button"
          onClick={() => setPwOpen(true)}
          className="flex items-center justify-between min-h-11 -mx-2 px-2 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
        >
          <div className="min-w-0 item-stack !gap-1">
            <p className="text-label !text-slate-900 font-semibold flex items-center gap-2">
              Đổi mật khẩu
              {mustChange && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                  <ShieldAlert className="h-3 w-3" /> Cần đổi
                </span>
              )}
            </p>
            <p className="text-meta">Đặt mật khẩu cá nhân mới</p>
          </div>
          <ChevronRight className="icon-sm text-slate-300 shrink-0" />
        </button>
      </section>

      <ChangePasswordDialog
        open={pwOpen}
        onOpenChange={setPwOpen}
        profileId={profileId}
        mustChange={mustChange}
      />
    </div>
  );
}
