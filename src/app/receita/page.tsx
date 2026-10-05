import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ReceitaView } from "@/components/receita/receita-view";

export const metadata: Metadata = { title: "Receita Federal" };

export default function ReceitaPage() {
  return (
    <>
      <PageHeader
        title="Contatos pela Receita Federal"
        description="Cruza as empresas da sua lista com os Dados Abertos de CNPJ para achar telefone e e-mail de quem não publicou contato no mapa."
      />
      <ReceitaView />
    </>
  );
}
