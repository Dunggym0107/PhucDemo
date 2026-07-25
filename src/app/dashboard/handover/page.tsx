"use client";

import React from "react";
import { Plus, Settings } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { canCreateDocument, canManageDocumentCategories, canViewAllDocuments } from "@/lib/permissions";
import { useHandover } from "./_hooks/useHandover";
import MyDeskInbox from "./_components/MyDeskInbox";
import MyDeskOutbox from "./_components/MyDeskOutbox";
import AllDocumentsTab from "./_components/AllDocumentsTab";
import CreateDocumentDialog from "./_components/CreateDocumentDialog";
import DocumentDetailDialog from "./_components/DocumentDetailDialog";
import CategoryManagerDialog from "./_components/CategoryManagerDialog";
import type { DeskTab } from "./_lib/constants";

export default function HandoverPage() {
  const state = useHandover();
  const {
    loading,
    loadingMore,
    hasMore,
    profile,
    allProfiles,
    categories,
    inboxDocs,
    outboxDocs,
    allDocs,
    activeTab,
    setActiveTab,
    selectedDocId,
    setSelectedDocId,
    isCreateOpen,
    setIsCreateOpen,
    refetch,
    loadMore,
  } = state;

  const [isCategoryOpen, setIsCategoryOpen] = React.useState(false);

  // Tài xế không tham gia luồng hồ sơ giấy — chặn truy cập
  if (!loading && !canCreateDocument(profile)) {
    return (
      <div className="page-container py-10">
        <p className="text-subtitle">
          Bạn không có quyền truy cập module Luân chuyển hồ sơ.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container py-10">
        <ListSkeleton variant="card" rows={6} />
      </div>
    );
  }

  const showAllTab = canViewAllDocuments(profile);
  const canManage = canManageDocumentCategories(profile);

  return (
    <div className="page-container space-y-8 motion-safe:animate-fade-in-up">
      <PageHeader
        title="Hồ sơ vật lý"
        description="Sổ giao nhận điện tử — theo dõi luồng luân chuyển hồ sơ bản cứng"
        action={
          <div className="flex items-center gap-2">
            {canManage && (
              <Button
                variant="outline"
                className="min-h-11 px-4 rounded-xl font-medium text-sm active:scale-[0.98] transition-all"
                onClick={() => setIsCategoryOpen(true)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Nhóm hồ sơ
              </Button>
            )}
            <Button
              className="bg-primary hover:bg-primary/90 px-5 font-medium h-11 active:scale-[0.98] transition-all"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="w-5 h-5 mr-2" /> Tạo hồ sơ
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DeskTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid sm:grid-cols-3 bg-gray shadow-sm ring-1 ring-slate-100">
          <TabsTrigger value="inbox" className="rounded-lg text-sm font-medium">
            Đang giữ
            {inboxDocs.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {inboxDocs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="outbox" className="rounded-lg text-sm font-medium">
            Đã chuyển
            {outboxDocs.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full status-neutral-bg text-xs font-semibold">
                {outboxDocs.length}
              </span>
            )}
          </TabsTrigger>
          {showAllTab && (
            <TabsTrigger value="all" className="rounded-lg text-sm font-medium col-span-2 sm:col-span-1">
              Toàn chi nhánh
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="inbox" className="mt-6">
          <MyDeskInbox
            documents={inboxDocs}
            profile={profile}
            onSelectDoc={setSelectedDocId}
          />
        </TabsContent>

        <TabsContent value="outbox" className="mt-6">
          <MyDeskOutbox
            documents={outboxDocs}
            profile={profile}
            onSelectDoc={setSelectedDocId}
          />
        </TabsContent>

        {showAllTab && (
          <TabsContent value="all" className="mt-6">
            <AllDocumentsTab
              documents={allDocs}
              onSelectDoc={setSelectedDocId}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Nút "Xem thêm" — cursor pagination, chỉ hiện khi còn trang sau */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {loadingMore ? "Đang tải thêm..." : "Xem thêm"}
          </button>
        </div>
      )}

      {/* Dialog tạo mới */}
      <CreateDocumentDialog
        isOpen={isCreateOpen}
        setIsOpen={setIsCreateOpen}
        categories={categories}
        profile={profile}
        onCreated={refetch}
      />

      {/* Dialog chi tiết */}
      <DocumentDetailDialog
        documentId={selectedDocId}
        isOpen={!!selectedDocId}
        setIsOpen={(v) => { if (!v) setSelectedDocId(null); }}
        profile={profile}
        allProfiles={allProfiles}
        onChanged={refetch}
      />

      {/* Dialog quản lý nhóm hồ sơ (admin) */}
      {canManage && (
        <CategoryManagerDialog
          isOpen={isCategoryOpen}
          setIsOpen={setIsCategoryOpen}
          categories={categories}
          onChanged={refetch}
        />
      )}
    </div>
  );
}
