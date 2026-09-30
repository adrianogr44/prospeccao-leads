import { describe, expect, it } from "vitest";
import { isPhoneWithAreaCode, leadPatchSchema } from "./contract";
import {
  DEFAULT_OUTREACH_SETTINGS,
  buildOutreachMessage,
  formatPrice,
  hostingCostSummary,
  normalizePhoneBR,
  outreachTarget,
  planMargin,
  outreachUrl,
  whatsappLink,
  type OutreachLead,
} from "./outreach";
import type { OutreachSettings } from "./contract";

const base: OutreachLead = {
  name: "Padaria Bom Pão",
  category: "padaria",
  city: "Aracaju",
  source: "google",
  siteStatus: "NONE",
  whatsapp: null,
  phone: null,
  phoneIsMobile: false,
  email: null,
};
const S = DEFAULT_OUTREACH_SETTINGS;
const MULTI_PLANS: OutreachSettings["plans"] = [
  { name: "Essencial", price: 997, description: "Página única" },
  { name: "Básico", price: 597, description: "Só o essencial" },
  { name: "Premium", price: 1697, description: "Tudo do Profissional, pixel de anúncios" },
];
const withTemplate =(template: string): OutreachSettings => ({ ...S, template });
const msg = (lead: Partial<OutreachLead>) => buildOutreachMessage({ ...base, ...lead }, withTemplate("{gancho}"));

describe("gancho por situação", () => {
  it("NONE do Google", () => {
    expect(msg({})).toBe("Encontrei a Padaria Bom Pão no Google e vi que vocês ainda não têm um site.");
  });
  it("NONE do OSM usa categoria e cidade", () => {
    expect(msg({ source: "osm" })).toBe(
      "Conheci a Padaria Bom Pão pesquisando por padaria em Aracaju e não encontrei o site de vocês.",
    );
  });
  it("SOCIAL_ONLY", () => {
    expect(msg({ siteStatus: "SOCIAL_ONLY" })).toBe(
      "Vi que a Padaria Bom Pão está nas redes sociais, mas ainda não tem um site próprio.",
    );
  });
  it("OLD", () => {
    expect(msg({ siteStatus: "OLD" })).toBe(
      "Visitei o site da Padaria Bom Pão e notei que ele está desatualizado, o que pode afastar quem acessa pelo celular.",
    );
  });
  it("UNREACHABLE", () => {
    expect(msg({ siteStatus: "UNREACHABLE" })).toBe("Tentei acessar o site da Padaria Bom Pão e ele está fora do ar.");
  });
  it("OK e UNKNOWN", () => {
    const expected = "Conheci a Padaria Bom Pão pesquisando por padaria em Aracaju.";
    expect(msg({ siteStatus: "OK" })).toBe(expected);
    expect(msg({ siteStatus: "UNKNOWN" })).toBe(expected);
  });
  it("sem cidade ou categoria cai para a frase genérica", () => {
    const generic = "Conheci a Padaria Bom Pão pesquisando empresas da região.";
    expect(msg({ siteStatus: "OK", city: null })).toBe(generic);
    expect(msg({ siteStatus: "UNKNOWN", category: null })).toBe(generic);
    expect(msg({ source: "osm", city: null })).toContain("pesquisando empresas da região");
  });
});

describe("marcadores", () => {
  it("preço inicial é o menor, formatado", () => {
    const settings = withTemplate("a partir de {preco_inicial}");
    expect(buildOutreachMessage(base, settings)).toBe("a partir de R$ 697");
    expect(buildOutreachMessage(base, { ...settings, plans: MULTI_PLANS })).toBe("a partir de R$ 597");
  });
  it("formata moeda: inteiro sem centavos, quebrado com duas casas", () => {
    expect(formatPrice(1697)).toBe("R$ 1.697");
    expect(formatPrice(40)).toBe("R$ 40");
    expect(formatPrice(27.96)).toBe("R$ 27,96");
    expect(formatPrice(39.9)).toBe("R$ 39,90");
  });
  it("{hospedagem}, {dominio} e {custos}", () => {
    expect(buildOutreachMessage(base, withTemplate("{hospedagem} | {dominio}"))).toBe("R$ 27,96/mês | R$ 40/ano");
    expect(buildOutreachMessage(base, withTemplate("{custos}"))).toBe(
      "O valor já inclui domínio .com.br e hospedagem no primeiro ano.",
    );
  });
  it("{custos} com cobrança à parte usa provedor, rótulo e preços das configurações", () => {
    const separate: OutreachSettings = { ...withTemplate("{custos}"), includeHostingAndDomain: false };
    expect(buildOutreachMessage(base, separate)).toBe(
      "Hospedagem na StayCloud a partir de R$ 27,96/mês e domínio .com.br no Registro.br por R$ 40/ano, contratados direto no seu nome.",
    );
    const custom: OutreachSettings = {
      ...separate,
      hosting: { ...S.hosting, provider: "Outra", monthlyPrice: 30 },
      domain: { label: ".com", yearlyPrice: 55.5 },
    };
    expect(buildOutreachMessage(base, custom)).toBe(
      "Hospedagem na Outra a partir de R$ 30/mês e domínio .com por R$ 55,50/ano, contratados direto no seu nome.",
    );
  });
  it("hostingCostSummary calcula primeiro ano e renovação", () => {
    expect(hostingCostSummary(S)).toEqual({ firstYear: 375.52, renewal: 518.8 });
    expect(formatPrice(hostingCostSummary(S).firstYear)).toBe("R$ 375,52");
    expect(formatPrice(hostingCostSummary(S).renewal)).toBe("R$ 518,80");
  });
  it("{oferta} com um plano cita nome e preço", () => {
    expect(buildOutreachMessage(base, withTemplate("{oferta}"))).toBe("Landing Page Completa por R$ 697");
  });
  it("{oferta} com 2 ou mais planos usa o menor preço", () => {
    const multi: OutreachSettings = { ...withTemplate("{oferta}"), plans: MULTI_PLANS };
    expect(buildOutreachMessage(base, multi)).toBe("Planos a partir de R$ 597");
  });
  it("planMargin: sobra por venda descontando o custo do primeiro ano", () => {
    expect(planMargin(697, S)).toBe(321.48);
    expect(formatPrice(planMargin(697, S))).toBe("R$ 321,48");
    expect(planMargin(375.52, S)).toBe(0);
    expect(planMargin(300, S)).toBeLessThan(0);
  });
  it("{planos} lista um por linha", () => {
    const multi: OutreachSettings = { ...withTemplate("{planos}"), plans: MULTI_PLANS };
    const out = buildOutreachMessage(base, multi).split("\n");
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("Essencial: R$ 997, Página única");
    expect(out[2]).toBe("Premium: R$ 1.697, Tudo do Profissional, pixel de anúncios");
  });
  it("substitui os demais marcadores", () => {
    const out = buildOutreachMessage(base, withTemplate("{remetente}|{minha_empresa}|{empresa}|{cidade}|{categoria}|{prazo}"));
    expect(out).toBe("Adriano|SitesCraft|Padaria Bom Pão|Aracaju|padaria|7");
  });
  it("marcador desconhecido fica como está", () => {
    expect(buildOutreachMessage(base, withTemplate("oi {nada} e {empresa}"))).toBe("oi {nada} e Padaria Bom Pão");
  });
  it("nome com chaves não é reinterpretado", () => {
    expect(buildOutreachMessage({ ...base, name: "X {cidade}" }, withTemplate("{empresa}"))).toBe("X {cidade}");
  });
  it("modelo padrão gera mensagem completa sem marcadores sobrando", () => {
    const out = buildOutreachMessage(base, S);
    expect(out).not.toMatch(/\{[a-z_]+\}/);
    expect(out).toContain("Aqui é Adriano, da SitesCraft.");
    expect(out).toContain("Landing Page Completa por R$ 697, com entrega em até 7 dias.");
    expect(out).toContain("O valor já inclui domínio .com.br e hospedagem no primeiro ano.");
  });
});

describe("outreachTarget", () => {
  it("WhatsApp confirmado tem prioridade", () => {
    expect(outreachTarget({ whatsapp: "(79) 99999-1234", phone: "7933334444", phoneIsMobile: false, email: "a@b.com" })).toEqual({
      kind: "whatsapp",
      confirmed: true,
      landline: false,
      number: "5579999991234",
    });
  });
  it("celular sem WhatsApp vira não confirmado", () => {
    expect(outreachTarget({ whatsapp: null, phone: "79 98888-7777", phoneIsMobile: true, email: "a@b.com" })).toEqual({
      kind: "whatsapp",
      confirmed: false,
      landline: false,
      number: "5579988887777",
    });
  });
  it("fixo cai para e-mail", () => {
    expect(outreachTarget({ whatsapp: null, phone: "7933334444", phoneIsMobile: false, email: "a@b.com" })).toEqual({
      kind: "email",
      email: "a@b.com",
    });
  });
  it("só telefone fixo vira tentativa de WhatsApp não confirmada", () => {
    expect(outreachTarget({ whatsapp: null, phone: "7933334444", phoneIsMobile: false, email: null })).toEqual({
      kind: "whatsapp",
      confirmed: false,
      landline: true,
      number: "557933334444",
    });
  });
  it("sem contato", () => {
    expect(outreachTarget({ whatsapp: null, phone: null, phoneIsMobile: false, email: null })).toEqual({ kind: "none" });
  });
});

describe("links", () => {
  it("normaliza o número", () => {
    expect(normalizePhoneBR("+55 (79) 99999-1234")).toBe("5579999991234");
    expect(normalizePhoneBR("79 3333-4444")).toBe("557933334444");
    expect(normalizePhoneBR("55 55 99999-1234")).toBe("5555999991234");
  });
  it("whatsappLink codifica acentos e quebras de linha", () => {
    const url = whatsappLink("(79) 99999-1234", "Olá, café!\n\nOk");
    expect(url).toBe("https://wa.me/5579999991234?text=Ol%C3%A1%2C%20caf%C3%A9!%0A%0AOk");
  });
  it("outreachUrl escolhe o destino e devolve null sem contato", () => {
    expect(outreachUrl({ ...base, whatsapp: "79999991234" }, "oi")).toBe("https://wa.me/5579999991234?text=oi");
    expect(outreachUrl({ ...base, email: "a@b.com" }, "oi")).toBe(
      "mailto:a@b.com?subject=Site%20para%20a%20Padaria%20Bom%20P%C3%A3o&body=oi",
    );
    expect(outreachUrl(base, "oi")).toBeNull();
  });
});

describe("leadPatchSchema.whatsapp", () => {
  it("aceita número com DDD, com ou sem 55, e null para apagar", () => {
    expect(leadPatchSchema.safeParse({ whatsapp: "(19) 99999-8888" }).success).toBe(true);
    expect(leadPatchSchema.safeParse({ whatsapp: "+55 19 3242-8929" }).success).toBe(true);
    expect(leadPatchSchema.safeParse({ whatsapp: null }).success).toBe(true);
  });
  it("recusa número sem DDD ou longo demais", () => {
    expect(leadPatchSchema.safeParse({ whatsapp: "99999-8888" }).success).toBe(false);
    expect(leadPatchSchema.safeParse({ whatsapp: "55 19 99999-8888 123" }).success).toBe(false);
    expect(isPhoneWithAreaCode("abc")).toBe(false);
  });
});
