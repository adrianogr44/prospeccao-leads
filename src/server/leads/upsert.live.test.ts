/**
 * Integração de banco (sem depender do OSM): upsert, dedupe, bloqueio, enriquecimento.
 * Só roda contra um banco descartável:
 *
 *   DATABASE_URL="file:./live-test.db" npx prisma migrate deploy
 *   LIVE=1 DATABASE_URL="file:./live-test.db" npx vitest run upsert.live
 *
 * O trecho de enriquecimento acessa https://example.com (rede real).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RawPlace } from "../providers/types";
import { normalizePlace, type NormalizedPlace } from "./normalize";

const enabled = Boolean(process.env.LIVE) && (process.env.DATABASE_URL ?? "").includes("live-test");

const { db } = await import("../db");
const { upsertPlaces } = await import("./upsert");
const { enrichLeads } = await import("../enrich/enrich-lead");

const place = (over: Partial<RawPlace> = {}): NormalizedPlace => {
  const p = normalizePlace({
    source: "google",
    externalId: "g1",
    name: "Padaria Pão Quente LTDA",
    category: "Padaria",
    city: "Varginha",
    state: "MG",
    neighborhood: null,
    address: null,
    postalCode: null,
    lat: -21.55,
    lng: -45.43,
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
  if (!p) throw new Error("place inválido");
  return p;
};

describe.skipIf(!enabled)("upsert + enriquecimento (banco descartável)", () => {
  let s1 = "";
  let s2 = "";

  beforeAll(async () => {
    await db.searchLead.deleteMany();
    await db.lead.deleteMany();
    await db.search.deleteMany();
    await db.blocked.deleteMany();
    const base = { category: "padaria", city: "Varginha" };
    s1 = (await db.search.create({ data: base })).id;
    s2 = (await db.search.create({ data: base })).id;
  });
  afterAll(() => db.$disconnect());

  it("cria lead sem site com 5 estrelas e motivo 'Não tem site'", async () => {
    const stats = await upsertPlaces(s1, [place()]);
    expect(stats).toMatchObject({ found: 1, created: 1, updated: 0 });
    const lead = await db.lead.findFirstOrThrow({ where: { externalId: "g1" } });
    expect(lead).toMatchObject({ siteStatus: "NONE", stars: 5, phoneIsMobile: false });
    expect(JSON.parse(lead.scoreReasons)).toContain("Não tem site");
  });

  it("mesma empresa outra vez: um lead só, updatedCount sobe, notas e contactedAt preservados", async () => {
    const contacted = new Date("2026-09-30T12:00:00Z");
    await db.lead.updateMany({ where: { externalId: "g1" }, data: { notes: "ligar amanhã", contactedAt: contacted } });
    const stats = await upsertPlaces(s2, [place({ rating: 4.8 })]);
    expect(stats).toMatchObject({ found: 1, created: 0, updated: 1 });
    expect(await db.lead.count()).toBe(1);
    const lead = await db.lead.findFirstOrThrow({ where: { externalId: "g1" } });
    expect(lead.notes).toBe("ligar amanhã");
    expect(lead.contactedAt?.toISOString()).toBe(contacted.toISOString());
    expect(lead.rating).toBe(4.8);
    // Repetir na mesma pesquisa não conta de novo
    expect(await upsertPlaces(s2, [place({ rating: 4.8 })])).toMatchObject({ found: 0 });
    expect(await db.searchLead.count()).toBe(2);
  });

  it("outra fonte, mesma empresa (nome + telefone): funde em vez de duplicar e só preenche vazios", async () => {
    const stats = await upsertPlaces(s2, [
      place({ source: "osm", externalId: "node/1", name: "Padaria Pao Quente", email: "oi@padaria.com.br", rating: null }),
    ]);
    expect(stats).toMatchObject({ created: 0 });
    expect(await db.lead.count()).toBe(1);
    const lead = await db.lead.findFirstOrThrow();
    expect(lead).toMatchObject({ source: "google", email: "oi@padaria.com.br", rating: 4.8 });
  });

  it("lead excluído (bloqueado) nunca é recriado", async () => {
    const lead = await db.lead.findFirstOrThrow();
    await db.$transaction([
      db.blocked.create({ data: { source: lead.source, externalId: lead.externalId } }),
      db.lead.delete({ where: { id: lead.id } }),
    ]);
    const stats = await upsertPlaces(s2, [place()]);
    expect(stats).toMatchObject({ found: 0, created: 0 });
    expect(await db.lead.count()).toBe(0);
  });

  it("Instagram como site vira SOCIAL_ONLY, e a análise não sobrescreve isso", async () => {
    await upsertPlaces(s1, [place({ externalId: "g2", name: "Doces da Ana", phone: null, website: "https://www.instagram.com/docesdaana" })]);
    const lead = await db.lead.findFirstOrThrow({ where: { externalId: "g2" } });
    expect(lead).toMatchObject({ siteStatus: "SOCIAL_ONLY", website: null, instagram: "https://www.instagram.com/docesdaana" });
    expect(lead.stars).toBe(5);
  });

  it("enriquecimento: site real é analisado; endereço interno vira UNREACHABLE sem ser requisitado", async () => {
    await upsertPlaces(s1, [
      place({ externalId: "g3", name: "Loja Exemplo", phone: "(35) 99999-1111", website: "https://example.com/" }),
      place({ externalId: "g4", name: "Loja Interna", phone: "(35) 3333-2222", website: "http://127.0.0.1:9/" }),
    ]);
    const ids = (await db.lead.findMany({ where: { externalId: { in: ["g3", "g4"] } }, select: { id: true } })).map((l) => l.id);
    expect(await enrichLeads(ids)).toBe(2);

    const ok = await db.lead.findFirstOrThrow({ where: { externalId: "g3" } });
    expect(["OK", "OLD"]).toContain(ok.siteStatus); // example.com é HTTPS e tem viewport: normalmente OK
    expect(Array.isArray(JSON.parse(ok.siteSignals ?? "null"))).toBe(true);
    expect(ok.enrichedAt).not.toBeNull();
    expect(ok.phoneIsMobile).toBe(true);
    expect(ok.whatsapp).toBeNull(); // nunca inferido do celular

    const blocked = await db.lead.findFirstOrThrow({ where: { externalId: "g4" } });
    expect(blocked.siteStatus).toBe("UNREACHABLE");

    // Reencontrar com o mesmo site mantém a análise
    await upsertPlaces(s2, [place({ externalId: "g3", name: "Loja Exemplo", phone: "(35) 99999-1111", website: "https://example.com/" })]);
    expect((await db.lead.findFirstOrThrow({ where: { externalId: "g3" } })).siteStatus).toBe(ok.siteStatus);
  }, 60_000);
});
