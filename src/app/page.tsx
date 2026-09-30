import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: { absolute: "Dashboard · Prospecção de Leads" } };

function DashboardFallback() {
  return (
    <div aria-busy="true" className="space-y-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-60 w-full rounded-panel" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-96 w-full rounded-panel" />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <Dashboard />
    </Suspense>
  );
}
