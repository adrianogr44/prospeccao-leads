import { describe, expect, it } from "vitest";
import { scoreLead, starsFor, type ScoreInput } from "./score";

const lead = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  source: "google",
  siteStatus: "OK",
  siteSignals: [],
  rating: null,
  reviewCount: null,
  whatsapp: null,
  instagram: null,
  businessStatus: "OPERATIONAL",
  ...over,
});

describe("starsFor", () => {
  it("respeita os limites", () => {
    expect([85, 84, 65, 64, 45, 44, 25, 24, 0].map(starsFor)).toEqual([5, 4, 4, 3, 3, 2, 2, 1, 1]);
  });
});

describe("scoreLead", () => {
  it("sem site: 5 estrelas e motivo 'Não tem site'", () => {
    const r = scoreLead(lead({ siteStatus: "NONE", whatsapp: "5535999998888" }));
    expect(r.score).toBe(90);
    expect(r.stars).toBe(5);
    expect(r.reasons).toContain("Não tem site");
  });

  it("sem site no OSM: indício, 4 estrelas e motivo pedindo confirmação", () => {
    const r = scoreLead(lead({ source: "osm", siteStatus: "NONE" }));
    expect(r.score).toBe(75);
    expect(r.stars).toBe(4);
    expect(r.reasons[0]).toBe("Sem site cadastrado no OpenStreetMap (confirmar)");
  });

  it("soma ajustes e limita em 100", () => {
    const r = scoreLead(lead({ siteStatus: "NONE", reviewCount: 3, instagram: "https://www.instagram.com/x" }));
    expect(r.score).toBe(100); // 90 + 10 (poucas avaliações) + 10 (sem WhatsApp) + 5, com teto
    expect(r.reasons).toContain("Poucas avaliações (3)");
    expect(r.reasons).toContain("Sem WhatsApp divulgado");
  });

  it("site antigo carrega os sinais como motivos", () => {
    const r = scoreLead(lead({ siteStatus: "OLD", siteSignals: ["Site sem versão para celular"], whatsapp: "5535999998888" }));
    expect(r.score).toBe(85);
    expect(r.reasons).toEqual(["Site antigo", "Site sem versão para celular"]);
  });

  it("site moderno e negócio saudável pontua baixo", () => {
    const r = scoreLead(lead({ siteStatus: "OK", whatsapp: "5535999998888", rating: 4.6, reviewCount: 120 }));
    expect(r.score).toBe(30); // 25 + 5
    expect(r.stars).toBe(2);
  });

  it("reviewCount nulo (fonte sem dado) não ganha bônus de poucas avaliações", () => {
    expect(scoreLead(lead({ siteStatus: "UNKNOWN", whatsapp: "5535999998888" })).score).toBe(50);
  });

  it("fechado permanentemente zera", () => {
    const r = scoreLead(lead({ siteStatus: "NONE", businessStatus: "CLOSED_PERMANENTLY" }));
    expect(r).toMatchObject({ score: 0, stars: 1 });
  });

  it("bases por situação do site", () => {
    const base = (siteStatus: ScoreInput["siteStatus"]) => scoreLead(lead({ siteStatus, whatsapp: "1", reviewCount: 500 })).score;
    expect([base("SOCIAL_ONLY"), base("UNREACHABLE"), base("UNKNOWN"), base("OK")]).toEqual([85, 75, 50, 25]);
  });
});
