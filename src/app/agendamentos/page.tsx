import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { SchedulesView } from "@/components/agendamentos/schedules-view";

export const metadata: Metadata = { title: "Agendamentos" };

export default function AgendamentosPage() {
  return (
    <>
      <PageHeader
        title="Agendamentos"
        description="Repita uma pesquisa todo dia, toda semana ou todo mês para achar empresas novas."
      />
      <SchedulesView />
    </>
  );
}
