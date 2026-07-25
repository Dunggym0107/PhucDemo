"use client";

import React from "react";
import { Send } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import DocumentCard from "./DocumentCard";
import type { DocumentRow } from "../_lib/types";

interface Props {
  documents: DocumentRow[];
  profile: any;
  onSelectDoc: (id: string) => void;
}

export default function MyDeskOutbox({ documents, onSelectDoc }: Props) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<Send className="w-7 h-7" />}
        title="Chưa chuyển hồ sơ nào"
        description="Sau khi tạo và chuyển hồ sơ cho người nhận, danh sách sẽ xuất hiện tại đây kèm vị trí hiện tại của hồ sơ."
      />
    );
  }

  const sorted = [...documents].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {sorted.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          variant="outbox"
          onClick={() => onSelectDoc(doc.id)}
        />
      ))}
    </div>
  );
}
