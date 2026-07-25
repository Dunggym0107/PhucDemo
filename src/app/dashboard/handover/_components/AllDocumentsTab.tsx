"use client";

import React from "react";
import { FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import DocumentCard from "./DocumentCard";
import { DOCUMENT_STATUS_META } from "../_lib/constants";
import type { DocumentRow } from "../_lib/types";
import type { DocumentStatus } from "../_lib/constants";

interface Props {
  documents: DocumentRow[];
  onSelectDoc: (id: string) => void;
}

const STATUS_FILTERS: Array<{ value: "all" | DocumentStatus; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "PENDING_RECEIPT", label: DOCUMENT_STATUS_META.PENDING_RECEIPT.label },
  { value: "IN_REVIEW", label: DOCUMENT_STATUS_META.IN_REVIEW.label },
  { value: "RETURNED", label: DOCUMENT_STATUS_META.RETURNED.label },
  { value: "COMPLETED", label: DOCUMENT_STATUS_META.COMPLETED.label },
];

export default function AllDocumentsTab({ documents, onSelectDoc }: Props) {
  const [statusFilter, setStatusFilter] = React.useState<"all" | DocumentStatus>("all");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!q) return true;
      return (
        d.short_code.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        (d.customer_name || "").toLowerCase().includes(q)
      );
    });
  }, [documents, statusFilter, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Input
          placeholder="Tìm mã hồ sơ, tiêu đề, khách hàng..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-11 bg-white border-slate-200 rounded-xl font-medium"
        />
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | DocumentStatus)}>
          <TabsList className="grid grid-cols-5 bg-white shadow-sm ring-1 ring-slate-100 min-h-10">
            {STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="rounded-md text-xs font-medium px-3">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-7 h-7" />}
          title="Không có hồ sơ nào khớp bộ lọc"
          description="Thử đổi trạng thái hoặc xoá từ khoá tìm kiếm."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              variant="all"
              onClick={() => onSelectDoc(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
