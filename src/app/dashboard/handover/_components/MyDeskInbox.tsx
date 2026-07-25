"use client";

import React from "react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import DocumentCard from "./DocumentCard";
import type { DocumentRow } from "../_lib/types";

interface Props {
  documents: DocumentRow[];
  profile: any;
  onSelectDoc: (id: string) => void;
}

export default function MyDeskInbox({ documents, profile, onSelectDoc }: Props) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="w-7 h-7" />}
        title="Bàn của bạn đang trống"
        description="Khi đồng nghiệp chuyển hồ sơ cho bạn, hồ sơ sẽ xuất hiện tại đây để xác nhận và xử lý."
      />
    );
  }

  // Sắp xếp: PENDING_RECEIPT (chờ nhận) lên trước, sau đó IN_REVIEW theo updated_at desc
  const sorted = [...documents].sort((a, b) => {
    if (a.status === "PENDING_RECEIPT" && b.status !== "PENDING_RECEIPT") return -1;
    if (a.status !== "PENDING_RECEIPT" && b.status === "PENDING_RECEIPT") return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {sorted.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          variant="inbox"
          currentProfileId={profile?.id}
          onClick={() => onSelectDoc(doc.id)}
        />
      ))}
    </div>
  );
}
