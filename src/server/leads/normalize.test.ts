import { describe, expect, it } from "vitest";
import type { RawPlace } from "../providers/types";
import { dedupeKey, distanceMeters, isMobileBR, isSamePlace, nationalPhoneDigits, normalizeName, normalizePlace, normalizeUrl, stateToUf } from "./normalize";

const raw = (over: Partial<RawPlace> = {}): RawPlace => ({
  source: "google",
  externalId: "abc",
  name: "Padaria Pão Quente",
  category: "Padaria",
  city: "Varginha",
  state: "MG",
  neighborhood: null,
  address: null,
  postalCode: null,
  lat: -21.5551,
  lng: -45.4302,
  mapsUrl: null,
  businessStatus: "OPERATIONAL",
  website: null,
  rating: 4.5,
  reviewCount: 10,
  openingHours: null,
  whatsapp: null,
  phone: "(35) 3221-1234",
  email: null,
  facebook: null,
  instagram: null,
  ownerName: null,
  ...over,
});

describe("normalizeName", () => {
  it("minúsculas, sem acento, sem pontuação e sem sufixos societários", () => {
    expect(normalizeName("Restaurante São João LTDA.")).toBe("restaurante sao joao");
    expect(normalizeName("Padaria Pão Quente - ME")).toBe("padaria pao quente");
    expect(normalizeName("ACME S/A")).toBe("acme");
    expect(normalizeName("Silva & Filhos EIRELI")).toBe("silva filhos");
  });
});

describe("telefone e dedupeKey", () => {
  it("tira código do país e formatação", () => {
    expect(nationalPhoneDigits("+55 (35) 3221-1234")).toBe("3532211234");
    expect(nationalPhoneDigits("035 3221-1234")).toBe("3532211234");
  });

  it("usa nome + telefone quando há telefone", () => {
    expect(dedupeKey("Padaria Pão Quente ME", "(35) 3221-1234", 1, 2)).toBe("padaria pao quente|3532211234");
    expect(dedupeKey("Padaria Pao Quente", "+55 35 3221-1234", null, null)).toBe("padaria pao quente|3532211234");
  });

  it("sem telefone usa coordenadas com 3 casas", () => {
    expect(dedupeKey("Padaria", null, -21.55512, -45.43012)).toBe("padaria|-21.555,-45.430");
    expect(dedupeKey("Padaria", null, null, null)).toBe("padaria|");
  });
});

describe("isMobileBR", () => {
  it("celular = DDD + 9 dígitos começando em 9", () => {
    expect(isMobileBR("(35) 99876-5432")).toBe(true);
    expect(isMobileBR("+55 35 99876-5432")).toBe(true);
    expect(isMobileBR("(35) 3221-1234")).toBe(false);
    expect(isMobileBR("(35) 8876-5432")).toBe(false);
    expect(isMobileBR(null)).toBe(false);
  });
});

describe("stateToUf / normalizeUrl", () => {
  it("converte nome de estado em UF", () => {
    expect(stateToUf("Minas Gerais")).toBe("MG");
    expect(stateToUf("são paulo")).toBe("SP");
    expect(stateToUf("mg")).toBe("MG");
    expect(stateToUf("")).toBeNull();
  });

  it("aceita URL sem esquema e recusa esquemas perigosos", () => {
    expect(normalizeUrl("www.padaria.com.br")).toBe("https://www.padaria.com.br/");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("ftp://x.com")).toBeNull();
    expect(normalizeUrl("  ")).toBeNull();
  });
});

describe("normalizePlace", () => {
  it("sem website vira NONE", () => {
    const p = normalizePlace(raw());
    expect(p?.siteStatus).toBe("NONE");
    expect(p?.website).toBeNull();
    expect(p?.phoneIsMobile).toBe(false);
  });

  it("website que é Instagram vira SOCIAL_ONLY e o link vai para o campo da rede", () => {
    const p = normalizePlace(raw({ website: "https://www.instagram.com/padaria.paoquente/?hl=pt" }));
    expect(p?.siteStatus).toBe("SOCIAL_ONLY");
    expect(p?.website).toBeNull();
    expect(p?.instagram).toBe("https://www.instagram.com/padaria.paoquente");
  });

  it("wa.me vira WhatsApp publicado; Linktree só marca SOCIAL_ONLY", () => {
    const wa = normalizePlace(raw({ website: "https://wa.me/5535998765432" }));
    expect(wa?.whatsapp).toBe("5535998765432");
    expect(wa?.siteStatus).toBe("SOCIAL_ONLY");
    expect(normalizePlace(raw({ website: "https://linktr.ee/padaria" }))?.siteStatus).toBe("SOCIAL_ONLY");
  });

  it("site real fica UNKNOWN até ser analisado", () => {
    const p = normalizePlace(raw({ website: "padaria.com.br" }));
    expect(p?.siteStatus).toBe("UNKNOWN");
    expect(p?.website).toBe("https://padaria.com.br/");
  });

  it("nunca infere WhatsApp do telefone", () => {
    expect(normalizePlace(raw({ phone: "(35) 99876-5432" }))?.whatsapp).toBeNull();
  });

  it("descarta lugar sem nome", () => {
    expect(normalizePlace(raw({ name: "   " }))).toBeNull();
  });
});


describe("isSamePlace", () => {
  const key = dedupeKey("Museu X", "(11) 5051-2654", -23.6002, -46.669);
  it("funde o ponto e o contorno do mesmo lugar, a poucos metros", () => {
    expect(
      isSamePlace({ dedupeKey: key, lat: -23.6002079, lng: -46.6690385 }, { dedupeKey: key, lat: -23.6001754, lng: -46.6690308 }),
    ).toBe(true);
  });
  it("não funde filiais que dividem o telefone central", () => {
    expect(isSamePlace({ dedupeKey: key, lat: -23.6002, lng: -46.669 }, { dedupeKey: key, lat: -23.55, lng: -46.64 })).toBe(false);
  });
  it("chaves diferentes nunca fundem", () => {
    expect(isSamePlace({ dedupeKey: "a|1", lat: 0, lng: 0 }, { dedupeKey: "b|1", lat: 0, lng: 0 })).toBe(false);
  });
  it("distância em metros confere", () => {
    expect(Math.round(distanceMeters(-23.6002079, -46.6690385, -23.6001754, -46.6690308))).toBeLessThan(10);
  });
});
