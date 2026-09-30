import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { SearchesView } from "@/components/pesquisas/searches-view";

export const metadata: Metadata = { title: "Pesquisas" };

export default function PesquisasPage() {
  return (
    <>
      <PageHeader
        title="Pesquisas"
        description="Busque empresas por categoria e cidade. Os resultados entram no dashboard conforme são encontrados."
      />
      <SearchesView />
    </>
  );
}
