import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { RecognitionType } from "../_lib/constants";

// Hook quản lý send/delete ghi nhận. Optimistic update — list được caller giữ.
// Caller (ProfileDetailDialog) truyền callback updater để insert/remove khỏi state local.
export function useRecognitions(opts: {
  senderId: string | null;
  receiverId: string | null;
  onOptimisticAdd?: (recog: any) => void;
  onOptimisticRemove?: (id: string) => void;
  onError?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [sending, setSending] = useState(false);

  const send = useCallback(async (params: {
    type: RecognitionType;
    content: string;
    receiverName: string;
  }) => {
    if (!opts.senderId || !opts.receiverId) {
      notifyValidation("Thiếu thông tin người gửi/nhận");
      return false;
    }
    const content = params.content.trim();
    if (content.length < 5) {
      notifyValidation("Nội dung ghi nhận tối thiểu 5 ký tự");
      return false;
    }

    setSending(true);
    const optimisticRecog = {
      id: `optimistic-${Date.now()}`,
      sender_id: opts.senderId,
      receiver_id: opts.receiverId,
      content,
      type: params.type,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    opts.onOptimisticAdd?.(optimisticRecog);

    try {
      const { data, error } = await supabase
        .from('recognitions')
        .insert({
          sender_id: opts.senderId,
          receiver_id: opts.receiverId,
          content,
          type: params.type,
        })
        .select('*, sender:profiles!recognitions_sender_id_fkey (id, full_name, avatar_url)')
        .single();
      if (error) throw error;

      opts.onOptimisticRemove?.(optimisticRecog.id);
      opts.onOptimisticAdd?.(data);

      // Notification cho receiver — server-side trigger có thể đã có, nhưng cứ insert phòng hờ.
      await supabase.from('notifications').insert({
        user_id: opts.receiverId,
        title: 'Bạn nhận được ghi nhận',
        content: `Đồng nghiệp đã ghi nhận: "${content.length > 60 ? content.slice(0, 60) + '…' : content}"`,
        link: `/dashboard/team?id=${opts.receiverId}`,
      });

      notifySuccess("Đã gửi ghi nhận");
      return true;
    } catch (error) {
      opts.onOptimisticRemove?.(optimisticRecog.id);
      opts.onError?.();
      notifyError(error, "Không gửi được ghi nhận");
      return false;
    } finally {
      setSending(false);
    }
  }, [opts, supabase]);

  const remove = useCallback(async (id: string) => {
    opts.onOptimisticRemove?.(id);
    try {
      const { error } = await supabase.from('recognitions').delete().eq('id', id);
      if (error) throw error;
      notifySuccess("Đã xoá ghi nhận");
      return true;
    } catch (error) {
      opts.onError?.();
      notifyError(error, "Không xoá được ghi nhận");
      return false;
    }
  }, [opts, supabase]);

  return { send, remove, sending };
}
