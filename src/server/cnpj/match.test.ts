import { describe, expect, it } from "vitest";
import {
  candidateNames,
  contactUpdate,
  matchEstablishment,
  MIN_CONFIDENCE,
  normalizeMunicipio,
  resolveMunicipio,
  type CnpjCandidate,
  type MatchTarget,
} from "./match";

function candidate(over: Partial<CnpjCandidate> & { cnpj: string }): CnpjCandidate {
  const nomeFantasia = over.nomeFantasia ?? null;
  const razaoSocial = over.razaoSocial ?? null;
  return {
    nomeFantasia,
    razaoSocial,
    ...candidateNames(nomeFantasia, razaoSocial),
    bairro: null,
    logradouro: null,
    phone: "+55 19 33683348",
    phone2: null,
    email: null,
    ...over,
  };
}

const lead = (over: Partial<MatchTarget> = {}): MatchTarget => ({
  name: "Churrascaria Rã-Chu",
  neighborhood: "Jardim Guanabara",
  address: "Rua Albano de Almeida Lima, 164 - Jardim Guanabara - Campinas",
  ...over,
});

describe("matchEstablishment", () => {
  it("nome fantasia idêntico casa sozinho, com confiança máxima", () => {
    const out = matchEstablishment(lead(), [candidate({ cnpj: "1", nomeFantasia: "CHURRASCARIA RA-CHU" })]);
    expect(out.kind).toBe("match");
    if (out.kind !== "match") return;
    expect(out.match.candidate.cnpj).toBe("1");
    expect(out.match.confidence).toBe(1);
    expect(out.match.reasons).toContain("Nome fantasia igual");
  });

  it("razão social idêntica casa, ignorando sufixo societário", () => {
    const out = matchEstablishment(lead(), [
      candidate({ cnpj: "1", razaoSocial: "CHURRASCARIA RA CHU LTDA", nomeFantasia: "RACHU GRILL" }),
    ]);
    expect(out.kind).toBe("match");
    if (out.kind !== "match") return;
    expect(out.match.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
    expect(out.match.reasons).toContain("Razão social igual");
  });

  it("nenhum candidato parecido não casa", () => {
    expect(matchEstablishment(lead(), [candidate({ cnpj: "1", nomeFantasia: "PIZZARIA DO JOAO" })]).kind).toBe("none");
    expect(matchEstablishment(lead(), []).kind).toBe("none");
  });

  // Critério 3 da story.
  it("dois estabelecimentos com o mesmo nome e sem desempate não casam", () => {
    const out = matchEstablishment(lead({ neighborhood: null, address: null }), [
      candidate({ cnpj: "1", nomeFantasia: "CHURRASCARIA RA-CHU", bairro: "CENTRO" }),
      candidate({ cnpj: "2", nomeFantasia: "CHURRASCARIA RA-CHU", bairro: "CAMBUI" }),
    ]);
    expect(out.kind).toBe("ambiguous");
    if (out.kind !== "ambiguous") return;
    expect(out.candidates).toHaveLength(2);
  });

  it("o bairro desempata dois estabelecimentos de nome igual", () => {
    const out = matchEstablishment(lead(), [
      candidate({ cnpj: "1", nomeFantasia: "CHURRASCARIA RA-CHU", bairro: "CENTRO" }),
      candidate({ cnpj: "2", nomeFantasia: "CHURRASCARIA RA-CHU", bairro: "JARDIM GUANABARA" }),
    ]);
    expect(out.kind).toBe("match");
    if (out.kind !== "match") return;
    expect(out.match.candidate.cnpj).toBe("2");
    expect(out.match.reasons).toContain("Mesmo bairro");
  });

  it("o logradouro desempata quando o bairro não ajuda", () => {
    const out = matchEstablishment(lead({ neighborhood: null }), [
      candidate({ cnpj: "1", nomeFantasia: "CHURRASCARIA RA-CHU", logradouro: "AVENIDA BRASIL" }),
      candidate({ cnpj: "2", nomeFantasia: "CHURRASCARIA RA-CHU", logradouro: "RUA ALBANO DE ALMEIDA LIMA" }),
    ]);
    expect(out.kind).toBe("match");
    if (out.kind !== "match") return;
    expect(out.match.candidate.cnpj).toBe("2");
    expect(out.match.reasons).toContain("Mesmo logradouro");
  });

  it("nome só parecido (prefixo) exige confirmação de endereço para passar do limiar", () => {
    const semEndereco = matchEstablishment(lead({ neighborhood: null, address: null }), [
      candidate({ cnpj: "1", nomeFantasia: "CHURRASCARIA RA CHU RESTAURANTE E BAR" }),
    ]);
    expect(semEndereco.kind).toBe("none");

    const comBairro = matchEstablishment(lead(), [
      candidate({ cnpj: "1", nomeFantasia: "CHURRASCARIA RA CHU RESTAURANTE E BAR", bairro: "JARDIM GUANABARA" }),
    ]);
    expect(comBairro.kind).toBe("match");
    if (comBairro.kind !== "match") return;
    expect(comBairro.match.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
  });

  it("nome curto de uma palavra não casa por prefixo", () => {
    const out = matchEstablishment(lead({ name: "Taishi" }), [
      candidate({ cnpj: "1", nomeFantasia: "TAISHI COMERCIO DE ALIMENTOS", bairro: "JARDIM GUANABARA" }),
    ]);
    expect(out.kind).toBe("none");
  });

  it("prefixo não vale no meio de uma palavra", () => {
    const out = matchEstablishment(lead({ name: "Casa Bonin" }), [
      candidate({ cnpj: "1", nomeFantasia: "CASA BONINHO MERCEARIA", bairro: "JARDIM GUANABARA" }),
    ]);
    expect(out.kind).toBe("none");
  });
});

// Critério 2 da story.
describe("contactUpdate", () => {
  const ficha = candidate({ cnpj: "1", nomeFantasia: "X", phone: "+55 19 33683348", email: "contato@x.com.br" });

  it("preenche telefone e e-mail quando o lead não tem", () => {
    expect(contactUpdate({ whatsapp: null, phone: null, email: null }, ficha)).toEqual({
      phone: "+55 19 33683348",
      phoneIsMobile: false,
      email: "contato@x.com.br",
    });
  });

  it("nunca sobrescreve telefone nem e-mail existentes", () => {
    expect(
      contactUpdate({ whatsapp: null, phone: "+55 19 99999-1111", email: "eu@empresa.com" }, ficha),
    ).toEqual({});
  });

  it("WhatsApp já confirmado não impede o telefone, e o telefone nunca vira WhatsApp", () => {
    const update = contactUpdate({ whatsapp: "5519999991111", phone: null, email: "eu@empresa.com" }, ficha);
    expect(update).toEqual({ phone: "+55 19 33683348", phoneIsMobile: false });
    expect(update).not.toHaveProperty("whatsapp");
  });

  it("marca celular quando o número da Receita é de celular", () => {
    const celular = candidate({ cnpj: "1", nomeFantasia: "X", phone: "+55 19 988887777", email: null });
    expect(contactUpdate({ whatsapp: null, phone: null, email: null }, celular)).toEqual({
      phone: "+55 19 988887777",
      phoneIsMobile: true,
    });
  });

  it("cai para o telefone 2 quando o 1 não existe", () => {
    const so2 = candidate({ cnpj: "1", nomeFantasia: "X", phone: null, phone2: "+55 19 32221111", email: null });
    expect(contactUpdate({ whatsapp: null, phone: null, email: null }, so2).phone).toBe("+55 19 32221111");
  });

  it("sem nada a acrescentar devolve objeto vazio", () => {
    const vazio = candidate({ cnpj: "1", nomeFantasia: "X", phone: null, phone2: null, email: null });
    expect(contactUpdate({ whatsapp: null, phone: null, email: null }, vazio)).toEqual({});
  });
});

describe("resolveMunicipio", () => {
  const rows = [
    { codigo: "6291", nome: "CAMPINAS" },
    { codigo: "8575", nome: "CAMPINAS DO SUL" },
    { codigo: "1041", nome: "CAMPINAS DO PIAUI" },
    { codigo: "5413", nome: "VARGINHA" },
    { codigo: "7107", nome: "SAO PAULO" },
  ].map((r) => ({ codigo: r.codigo, nomeNormalizado: normalizeMunicipio(r.nome) }));

  it("acha o código exato sem confundir com homônimos compostos", () => {
    expect(resolveMunicipio("Campinas", rows)).toEqual(["6291"]);
    expect(resolveMunicipio("campinas do sul", rows)).toEqual(["8575"]);
  });

  it("ignora acento, caixa e pontuação", () => {
    expect(resolveMunicipio("São Paulo", rows)).toEqual(["7107"]);
    expect(resolveMunicipio("  VARGINHA ", rows)).toEqual(["5413"]);
  });

  it("devolve todos os códigos de nomes iguais (a tabela da Receita não tem UF)", () => {
    const comHomonimo = [
      ...rows,
      { codigo: "1234", nomeNormalizado: normalizeMunicipio("Bom Jesus") },
      { codigo: "5678", nomeNormalizado: normalizeMunicipio("BOM JESUS") },
    ];
    expect(resolveMunicipio("Bom Jesus", comHomonimo)).toEqual(["1234", "5678"]);
  });

  it("cidade desconhecida ou vazia devolve lista vazia", () => {
    expect(resolveMunicipio("Hogsmeade", rows)).toEqual([]);
    expect(resolveMunicipio("  ", rows)).toEqual([]);
  });
});
