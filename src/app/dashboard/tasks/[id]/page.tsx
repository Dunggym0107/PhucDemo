'use client';

// Backward compat: noti link cũ /dashboard/tasks/[id] → redirect sang /dashboard/tasks?id=
// Tasks detail giờ là Dialog đồng bộ với pattern Hồ sơ/Schedule.

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function TaskDetailRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id ?? '') as string;

  useEffect(() => {
    if (id) router.replace(`/dashboard/tasks?id=${id}`);
    else router.replace('/dashboard/tasks');
  }, [id, router]);

  return (
    <div className="page-container py-20 flex items-center justify-center">
      <Loader2 className="icon-lg animate-spin text-slate-500" />
    </div>
  );
}
