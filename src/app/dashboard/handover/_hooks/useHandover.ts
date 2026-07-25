"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppData } from "@/hooks/use-app-data";
import { canViewAllDocuments } from "@/lib/permissions";
import {
  fetchAllDocuments,
  fetchCategories,
  PAGE_SIZE,
} from "../_lib/fetchHandover";
import type { DocumentCategory, DocumentRow } from "../_lib/types";
import type { DeskTab } from "../_lib/constants";

interface UseHandoverState {
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  profile: any;
  allProfiles: any[];
  documents: DocumentRow[];
  categories: DocumentCategory[];
  activeTab: DeskTab;
  setActiveTab: (t: DeskTab) => void;
  inboxDocs: DocumentRow[];
  outboxDocs: DocumentRow[];
  allDocs: DocumentRow[];
  // Dialogs
  selectedDocId: string | null;
  setSelectedDocId: (id: string | null) => void;
  isCreateOpen: boolean;
  setIsCreateOpen: (v: boolean) => void;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useHandover(): UseHandoverState {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // currentProfile + profiles từ AppDataProvider — không tự fetch nữa (tiết kiệm 2 request/nav)
  const { currentProfile, profiles } = useAppData();
  const profile = currentProfile; // giữ alias để code dưới + consumer không phải đổi
  const allProfiles = useMemo(
    () => profiles.filter((p) => p.role !== 'admin'),
    [profiles]
  );

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [hasMore, setHasMore] = useState(false);

  // Con trỏ cho cursor pagination: updated_at của item cuối cùng đã fetch
  const cursorRef = useRef<string | undefined>(undefined);

  const [activeTab, setActiveTab] = useState<DeskTab>("inbox");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Auto-open dialog theo URL params:
  //   ?id=<doc_id>  → mở dialog chi tiết (link từ push notification)
  //   ?create=1     → mở dialog tạo mới (do MobileCreateFab bấm)
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam) setSelectedDocId(idParam);

    const createParam = searchParams.get("create");
    if (createParam === "1") {
      setIsCreateOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("create");
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [searchParams, pathname, router]);

  // Refetch page 1 (reset cursor) — dùng cho initial load + realtime
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetch = useCallback(async () => {
    const { data, hasMore: hm } = await fetchAllDocuments({ limit: PAGE_SIZE });
    cursorRef.current = data.length > 0 ? data[data.length - 1].updated_at : undefined;
    setDocuments(data);
    setHasMore(hm);
  }, []);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      refetch();
    }, 250);
  }, [refetch]);

  // Load more (cursor-based, append)
  const loadMore = useCallback(async () => {
    if (!cursorRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data, hasMore: hm } = await fetchAllDocuments({
        limit: PAGE_SIZE,
        before: cursorRef.current,
      });
      cursorRef.current = data.length > 0 ? data[data.length - 1].updated_at : undefined;
      setDocuments((prev) => [...prev, ...data]);
      setHasMore(hm);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  // Initial load — chỉ fetch documents + categories, profile/profiles từ AppDataProvider
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        if (!currentProfile) return; // chờ provider hydrate

        const [docsResult, cats] = await Promise.all([
          fetchAllDocuments({ limit: PAGE_SIZE }),
          fetchCategories(),
        ]);

        if (!active) return;
        cursorRef.current =
          docsResult.data.length > 0
            ? docsResult.data[docsResult.data.length - 1].updated_at
            : undefined;
        setDocuments(docsResult.data);
        setHasMore(docsResult.hasMore);
        setCategories(cats);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [currentProfile?.id]);

  // Realtime subscribe — bám sát pattern useSchedule
  useEffect(() => {
    if (!profile) return;
    // Tách INSERT/UPDATE/DELETE để tránh subscribe TRUNCATE/replication không cần thiết.
    const channel = supabase
      .channel("handover_realtime_sync")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "documents" }, scheduleRefetch)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "documents" }, scheduleRefetch)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "documents" }, scheduleRefetch)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "document_handovers" },
        (payload: any) => {
          if ((payload.new as any)?.receiver_id === profile.id) {
            toast({
              title: "Có hồ sơ mới chờ nhận",
              description: "Mở tab \"Đang giữ\" để xem chi tiết.",
            });
          }
          scheduleRefetch();
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "document_handovers" }, scheduleRefetch)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "document_handovers" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_categories" }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, profile, scheduleRefetch, toast]);

  // Phân loại 3 list cho 3 tab.
  // Lưu ý: khi status=PENDING_RECEIPT, doc.current_assignee_id vẫn là sender
  // (RPC chỉ chuyển ownership khi receiver acknowledge). Vì vậy phải dùng handover
  // PENDING để xác định ai đang chờ nhận, không dựa thuần vào current_assignee_id.
  const inboxDocs = useMemo(() => {
    if (!profile) return [] as DocumentRow[];
    return documents.filter((d) => {
      // Tôi đang chờ nhận từ ai đó
      const incomingPending = (d.handovers || []).some(
        (h) => h.receiver_id === profile.id && h.status === "PENDING"
      );
      if (incomingPending) return true;

      // Tôi đang giữ hồ sơ — nhưng nếu đã chuyển tiếp (có outgoing PENDING) thì
      // không hiện ở đây, mà thuộc Outbox.
      if (d.current_assignee_id === profile.id) {
        const outgoingPending = (d.handovers || []).some(
          (h) => h.sender_id === profile.id && h.status === "PENDING"
        );
        return !outgoingPending;
      }
      return false;
    });
  }, [documents, profile]);

  const outboxDocs = useMemo(() => {
    if (!profile) return [] as DocumentRow[];
    return documents.filter((d) => {
      // Đang chờ người khác nhận hồ sơ mình vừa chuyển — luôn ở Outbox
      const outgoingPending = (d.handovers || []).some(
        (h) => h.sender_id === profile.id && h.status === "PENDING"
      );
      if (outgoingPending) return true;

      // Hồ sơ đang ở bàn mình → đã ở Inbox, không trùng
      if (d.current_assignee_id === profile.id) return false;

      // Tôi từng là creator hoặc sender trong lịch sử → vẫn theo dõi ở Outbox
      if (d.creator_id === profile.id) return true;
      return (d.handovers || []).some((h) => h.sender_id === profile.id);
    });
  }, [documents, profile]);

  const allDocs = useMemo(() => {
    if (!canViewAllDocuments(profile)) return [] as DocumentRow[];
    return documents;
  }, [documents, profile]);

  return {
    loading,
    loadingMore,
    hasMore,
    profile,
    allProfiles,
    documents,
    categories,
    activeTab,
    setActiveTab,
    inboxDocs,
    outboxDocs,
    allDocs,
    selectedDocId,
    setSelectedDocId,
    isCreateOpen,
    setIsCreateOpen,
    refetch,
    loadMore,
  };
}
