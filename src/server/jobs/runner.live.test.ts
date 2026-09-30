/**
 * Integração real (rede + banco): roda o runner com o OpenStreetMap e confere fila, dedupe,
 * bloqueio e retomada. Precisa de um banco descartável, nunca o dev.db:
 *
 *   DATABASE_URL="file:./live-test.db" npx prisma migrate deploy
 *   LIVE=1 DATABASE_URL="file:./live-test.db" npx vitest run runner.live
 */
import { afterAll, describe, expect, it } from "vitest";

const enabled = Boolean(process.env.LIVE) && (process.env.DATABASE_URL ?? "").includes("live-test");

const { db } = await import("../db");
const { getRunner } = await import("./runner");

async function waitFor(id: string, statuses: string[], timeoutMs = 240_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const s = await db.search.findUniqueOrThrow({ where: { id } });
    if (statuses.includes(s.status)) return s;
    if (Date.now() > end) throw new Error(`timeout esperando ${id} (status ${s.status})`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const base = { category: process.env.LIVE_CATEGORY ?? "restaurante", city: "Varginha", state: "MG", radiusKm: 2, provider: "osm", maxLeads: 25 };

describe.skipIf(!enabled)("runner ao vivo (OSM, banco descartável)", () => {
  afterAll(() => db.$disconnect());

  it("pesquisa termina, dedupe atualiza, notas e bloqueio são respeitados", async () => {
    const first = await db.search.create({ data: base });
    getRunner().kick();
    const done1 = await waitFor(first.id, ["done", "failed"]);
    console.log("[LIVE] pesquisa 1:", JSON.stringify({ ...done1, cursor: undefined }));
    expect(done1.status).toBe("done");
    expect(done1.error).toBeNull();
    expect(done1.foundCount).toBeGreaterThan(0);
    expect(done1.newCount).toBe(done1.foundCount);
    expect(done1.requestCount).toBeGreaterThan(0);

    const leads = await db.lead.findMany({ select: { id: true, source: true, externalId: true, siteStatus: true, stars: true, city: true, state: true } });
    expect(leads).toHaveLength(done1.foundCount);
    expect(leads.every((l) => l.state === "MG" && l.city)).toBe(true);
    const byStatus = leads.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.siteStatus]: (acc[l.siteStatus] ?? 0) + 1 }), {});
    console.log("[LIVE] siteStatus:", JSON.stringify(byStatus));

    // Mesma pesquisa de novo: nada novo, tudo atualizado, notas preservadas
    const [kept, blocked] = leads;
    await db.lead.update({ where: { id: kept.id }, data: { notes: "ligar amanhã" } });
    const second = await db.search.create({ data: base });
    getRunner().kick();
    const done2 = await waitFor(second.id, ["done", "failed"]);
    console.log("[LIVE] pesquisa 2:", JSON.stringify({ ...done2, cursor: undefined }));
    expect(done2.status).toBe("done");
    expect(done2.newCount).toBe(0);
    expect(done2.updatedCount).toBe(done2.foundCount);
    expect(await db.lead.count()).toBe(leads.length);
    expect((await db.lead.findUniqueOrThrow({ where: { id: kept.id } })).notes).toBe("ligar amanhã");

    // Lead excluído nunca volta
    await db.$transaction([
      db.blocked.create({ data: { source: blocked.source, externalId: blocked.externalId } }),
      db.lead.delete({ where: { id: blocked.id } }),
    ]);
    const third = await db.search.create({ data: base });
    getRunner().kick();
    await waitFor(third.id, ["done", "failed"]);
    expect(await db.lead.count({ where: { externalId: blocked.externalId } })).toBe(0);
    expect(await db.lead.count()).toBe(leads.length - 1);
  }, 600_000);

  it("pesquisa pausada não roda até ser retomada; running órfã volta para a fila", async () => {
    const paused = await db.search.create({ data: { ...base, status: "paused" } });
    getRunner().kick();
    await new Promise((r) => setTimeout(r, 1500));
    expect((await db.search.findUniqueOrThrow({ where: { id: paused.id } })).status).toBe("paused");

    await db.search.update({ where: { id: paused.id }, data: { status: "queued" } });
    getRunner().kick();
    expect((await waitFor(paused.id, ["done", "failed"])).status).toBe("done");

    const orphan = await db.search.create({ data: { ...base, status: "running" } });
    await getRunner().recover();
    expect((await waitFor(orphan.id, ["done", "failed"])).status).toBe("done");
  }, 600_000);

  it("fonte google sem chave falha com mensagem orientando", async () => {
    const s = await db.search.create({ data: { ...base, provider: "google" } });
    getRunner().kick();
    const r = await waitFor(s.id, ["done", "failed"]);
    expect(r.status).toBe("failed");
    expect(r.error).toContain("GOOGLE_PLACES_API_KEY");
  }, 60_000);
});
