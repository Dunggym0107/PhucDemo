'use client';

// Backward compat: route /dashboard/tasks/new cũ → redirect sang
// /dashboard/tasks?create=1 (dialog popup).

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function NewTaskRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/tasks?create=1');
  }, [router]);
  return (
    <div className="page-container py-20 flex items-center justify-center">
      <Loader2 className="icon-lg animate-spin text-slate-500" />
    </div>
  );
}
