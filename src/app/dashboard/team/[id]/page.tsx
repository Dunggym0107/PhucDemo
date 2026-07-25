import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Stub backward-compat — chuyển sang Detail = Dialog (?id=).
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  redirect(`/dashboard/team?id=${id}`);
}
