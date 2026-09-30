import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { SettingsView } from "@/components/configuracoes/settings-view";

export const metadata: Metadata = { title: "Configurações" };

export default function ConfiguracoesPage() {
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Dados da sua empresa, planos e o modelo da mensagem de abordagem."
      />
      <SettingsView />
    </>
  );
}
