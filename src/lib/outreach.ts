/**
 * Abordagem por WhatsApp/e-mail (Story 1.4). Funções puras: sem React, sem rede.
 * O sistema só monta o texto e o link; quem envia é a pessoa.
 */
import type { LeadDTO, OutreachSettings } from "./contract";

export const DEFAULT_TEMPLATE = `Olá! Tudo bem? Aqui é {remetente}, da {minha_empresa}.

{gancho}

Criamos páginas profissionais para negócios como o seu, prontas para aparecer no Google e receber contatos pelo WhatsApp: {oferta}, com entrega em até {prazo} dias.

{custos}

Posso te mandar um exemplo sem compromisso?`;

/** Padrões usados quando não há configuração salva e no botão "Restaurar padrão". */
export const DEFAULT_OUTREACH_SETTINGS: OutreachSettings = {
  companyName: "SitesCraft",
  senderName: "Adriano",
  deliveryDays: 7,
  includeHostingAndDomain: true,
  hosting: {
    provider: "StayCloud",
    monthlyPrice: 27.96,
    renewalMonthlyPrice: 39.9,
    url: "https://br.staycloud.com.br/prince",
  },
  domain: { label: ".com.br no Registro.br", yearlyPrice: 40 },
  plans: [
    {
      name: "Landing Page Completa",
      price: 697,
      description:
        "Página profissional adaptada a celular, botão de WhatsApp, formulário de contato e Google Analytics, com domínio .com.br e hospedagem do primeiro ano",
    },
  ],
  template: DEFAULT_TEMPLATE,
};

/** Marcadores aceitos no modelo (para a lista de ajuda em Configurações). */
export const OUTREACH_PLACEHOLDERS: ReadonlyArray<{ key: string; help: string }> = [
  { key: "remetente", help: "Seu nome" },
  { key: "minha_empresa", help: "Nome da sua empresa" },
  { key: "empresa", help: "Nome da empresa abordada" },
  { key: "cidade", help: "Cidade da empresa abordada" },
  { key: "categoria", help: "Categoria da empresa abordada" },
  { key: "gancho", help: "Frase de abertura conforme a situação do site" },
  { key: "preco_inicial", help: "Menor preço entre os planos" },
  { key: "oferta", help: "Oferta pronta: o plano único com preço, ou \"Planos a partir de R$ X\"" },
  { key: "planos", help: "Lista dos planos, um por linha" },
  { key: "prazo", help: "Prazo de entrega em dias" },
  { key: "hospedagem", help: "Mensalidade da hospedagem, ex.: R$ 27,96/mês" },
  { key: "dominio", help: "Anuidade do domínio, ex.: R$ 40/ano" },
  { key: "custos", help: "Frase pronta com hospedagem e domínio pagos pelo cliente" },
];

export type OutreachLead = Pick<
  LeadDTO,
  "name" | "category" | "city" | "source" | "siteStatus" | "whatsapp" | "phone" | "phoneIsMobile" | "email"
>;

/** Inteiro sem centavos (R$ 597); quebrado com duas casas (R$ 27,96). */
export function formatPrice(value: number): string {
  const cents = Number.isInteger(value) ? 0 : 2;
  return `R$ ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: cents, maximumFractionDigits: cents }).format(value)}`;
}

function hook(lead: OutreachLead): string {
  const empresa = lead.name;
  const categoria = lead.category?.trim();
  const cidade = lead.city?.trim();
  const search =
    categoria && cidade
      ? `Conheci a ${empresa} pesquisando por ${categoria} em ${cidade}.`
      : `Conheci a ${empresa} pesquisando empresas da região.`;

  switch (lead.siteStatus) {
    case "NONE":
      return lead.source === "google"
        ? `Encontrei a ${empresa} no Google e vi que vocês ainda não têm um site.`
        : categoria && cidade
          ? `Conheci a ${empresa} pesquisando por ${categoria} em ${cidade} e não encontrei o site de vocês.`
          : `Conheci a ${empresa} pesquisando empresas da região e não encontrei o site de vocês.`;
    case "SOCIAL_ONLY":
      return `Vi que a ${empresa} está nas redes sociais, mas ainda não tem um site próprio.`;
    case "OLD":
      return `Visitei o site da ${empresa} e notei que ele está desatualizado, o que pode afastar quem acessa pelo celular.`;
    case "UNREACHABLE":
      return `Tentei acessar o site da ${empresa} e ele está fora do ar.`;
    case "OK":
    case "UNKNOWN":
      return search;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Custo de referência de hospedagem + domínio: 1º ano e renovação (12 meses de hospedagem + domínio). */
export function hostingCostSummary(settings: Pick<OutreachSettings, "hosting" | "domain">): {
  firstYear: number;
  renewal: number;
} {
  const { hosting, domain } = settings;
  return {
    firstYear: round2(12 * hosting.monthlyPrice + domain.yearlyPrice),
    renewal: round2(12 * hosting.renewalMonthlyPrice + domain.yearlyPrice),
  };
}

/** Sobra por venda quando o preço do plano já embute o custo do primeiro ano (pode ser negativa). */
export function planMargin(price: number, settings: Pick<OutreachSettings, "hosting" | "domain">): number {
  return round2(price - hostingCostSummary(settings).firstYear);
}

/** Preenche o modelo. Marcadores desconhecidos ficam como estão. */
export function buildOutreachMessage(lead: OutreachLead, settings: OutreachSettings): string {
  const cheapest = settings.plans.length ? Math.min(...settings.plans.map((p) => p.price)) : 0;
  const hosting = `${formatPrice(settings.hosting.monthlyPrice)}/mês`;
  const domain = `${formatPrice(settings.domain.yearlyPrice)}/ano`;
  const values: Record<string, string> = {
    remetente: settings.senderName,
    minha_empresa: settings.companyName,
    empresa: lead.name,
    cidade: lead.city ?? "",
    categoria: lead.category ?? "",
    gancho: hook(lead),
    preco_inicial: formatPrice(cheapest),
    oferta:
      settings.plans.length === 1
        ? `${settings.plans[0].name} por ${formatPrice(settings.plans[0].price)}`
        : `Planos a partir de ${formatPrice(cheapest)}`,
    planos: settings.plans
      .map((p) => `${p.name}: ${formatPrice(p.price)}${p.description ? `, ${p.description}` : ""}`)
      .join("\n"),
    prazo: String(settings.deliveryDays),
    hospedagem: hosting,
    dominio: domain,
    custos: settings.includeHostingAndDomain
      ? "O valor já inclui domínio .com.br e hospedagem no primeiro ano."
      : `Hospedagem na ${settings.hosting.provider} a partir de ${hosting} e domínio ${settings.domain.label} por ${domain}, contratados direto no seu nome.`,
  };
  // Uma passada só: o texto inserido (ex.: nome com chaves) nunca é reinterpretado.
  return settings.template.replace(/\{([a-z_]+)\}/g, (whole, key: string) =>
    Object.hasOwn(values, key) ? values[key] : whole,
  );
}

/** Só dígitos; número com 10 ou 11 dígitos (DDD + número) ganha o DDI 55, mesmo quando o DDD é 55. */
export function normalizePhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export function whatsappLink(number: string, message: string): string {
  return `https://wa.me/${normalizePhoneBR(number)}?text=${encodeURIComponent(message)}`;
}

export type OutreachTarget =
  | { kind: "whatsapp"; confirmed: boolean; landline: boolean; number: string }
  | { kind: "email"; email: string }
  | { kind: "none" };

export function outreachTarget(lead: Pick<OutreachLead, "whatsapp" | "phone" | "phoneIsMobile" | "email">): OutreachTarget {
  if (lead.whatsapp) return { kind: "whatsapp", confirmed: true, landline: false, number: normalizePhoneBR(lead.whatsapp) };
  if (lead.phone && lead.phoneIsMobile) {
    return { kind: "whatsapp", confirmed: false, landline: false, number: normalizePhoneBR(lead.phone) };
  }
  if (lead.email) return { kind: "email", email: lead.email };
  // Muitas empresas usam o fixo no WhatsApp Business: vale a tentativa, sem afirmar que existe.
  if (lead.phone) return { kind: "whatsapp", confirmed: false, landline: true, number: normalizePhoneBR(lead.phone) };
  return { kind: "none" };
}

export function mailtoLink(email: string, leadName: string, message: string): string {
  const subject = encodeURIComponent(`Site para a ${leadName}`);
  const body = encodeURIComponent(message.replace(/\n/g, "\r\n"));
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

/** URL final do destino, ou null quando a empresa não tem contato publicado. */
export function outreachUrl(lead: OutreachLead, message: string): string | null {
  const target = outreachTarget(lead);
  if (target.kind === "whatsapp") return whatsappLink(target.number, message);
  if (target.kind === "email") return mailtoLink(target.email, lead.name, message);
  return null;
}
