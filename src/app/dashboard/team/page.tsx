import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import PageHeader from "@/components/layout/PageHeader";
import TeamPage from "./_components/TeamPage";

export default function Page() {
  return (
    <Suspense fallback={
      <div className="page-container space-y-6 md:section-stack motion-safe:animate-fade-in-up">
        <PageHeader title="Nhân sự" description="Danh bạ và sơ đồ tổ chức chi nhánh" />
        <ListSkeleton variant="card" rows={6} />
      </div>
    }>
      <TeamPage />
    </Suspense>
  );
}
