/**
 * Chama os route handlers direto (sem subir o Next) contra um banco descartável já populado
 * (rode antes upsert.live.test.ts):
 *
 *   LIVE=1 DATABASE_URL="file:./live-test.db" npx vitest run api.live
 */
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";

const enabled = Boolean(process.env.LIVE) && (process.env.DATABASE_URL ?? "").includes("live-test");

const { db } = await import("@/server/db");
const meta = await import("./meta/route");
const leads = await import("./leads/route");
const lead = await import("./leads/[id]/route");
const stats = await import("./stats/route");
const exportRoute = await import("./export/route");
const sheets = await import("./export/sheets/route");
const searches = await import("./searches/route");
const search = await import("./searches/[id]/route");
const schedules = await import("./schedules/route");
const schedule = await import("./schedules/[id]/route");

const url = (path: string) => `http://localhost:3000${path}`;
const get = (path: string) => new NextRequest(url(path));
const send = (path: string, method: string, body: unknown) =>
  new NextRequest(url(path), { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe.skipIf(!enabled)("rotas /api (banco descartável)", () => {
  afterAll(() => db.$disconnect());

  it("GET /api/meta", async () => {
    const body = await (await meta.GET()).json();
    expect(body.config).toEqual({ googlePlaces: false, googleSheets: false, serviceAccountEmail: null });
    expect(Array.isArray(body.cities)).toBe(true);
  });

  it("GET /api/leads filtra, ordena e pagina; entrada inválida devolve 400 ApiError", async () => {
    const res = await leads.GET(get("/api/leads?pageSize=10&hasSite=no&sort=score&dir=desc&q="));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.pageSize).toBe(10);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((l: { siteStatus: string }) => ["NONE", "SOCIAL_ONLY"].includes(l.siteStatus))).toBe(true);
    const scores = body.items.map((l: { score: number }) => l.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);

    const bad = await leads.GET(get("/api/leads?pageSize=5&minStars=9"));
    expect(bad.status).toBe(400);
    const err = await bad.json();
    expect(err.error).toBe("Dados inválidos.");
    expect(err.details.length).toBeGreaterThan(0);
  });

  it("GET /api/stats", async () => {
    const body = await (await stats.GET(get("/api/stats"))).json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.withSite + body.withoutSite).toBe(body.total);
    expect(body.byStars).toHaveLength(5);
    expect(Array.isArray(body.byCity)).toBe(true);
  });

  it("PATCH e DELETE /api/leads/:id (DELETE bloqueia reimportação)", async () => {
    const first = await db.lead.findFirstOrThrow();
    const patched = await lead.PATCH(send(`/api/leads/${first.id}`, "PATCH", { notes: "  teste  " }), ctx(first.id));
    expect((await patched.json()).notes).toBe("teste");
    expect((await lead.PATCH(send(`/api/leads/${first.id}`, "PATCH", { notes: 5 }), ctx(first.id))).status).toBe(400);

    const del = await lead.DELETE(get(`/api/leads/${first.id}`), ctx(first.id));
    expect(del.status).toBe(204);
    expect(await db.blocked.count({ where: { source: first.source, externalId: first.externalId } })).toBe(1);
    expect((await lead.DELETE(get(`/api/leads/${first.id}`), ctx(first.id))).status).toBe(404);
  });

  it("GET /api/export em csv, json e xlsx respeita filtros", async () => {
    const csv = await exportRoute.GET(get("/api/export?format=csv&hasSite=no"));
    expect(csv.headers.get("content-type")).toContain("text/csv");
    const buf = Buffer.from(await csv.arrayBuffer());
    expect(buf.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const text = buf.toString("utf8");
    expect(text.split("\r\n")[0]).toContain("Nome;Categoria");

    const json = await (await exportRoute.GET(get("/api/export?format=json&hasSite=no"))).json();
    expect(json.every((l: { siteStatus: string }) => ["NONE", "SOCIAL_ONLY"].includes(l.siteStatus))).toBe(true);
    expect(text.trim().split("\r\n").length - 1).toBe(json.length);

    const xlsx = await exportRoute.GET(get("/api/export?format=xlsx"));
    const bytes = Buffer.from(await xlsx.arrayBuffer());
    expect(bytes.subarray(0, 2).toString()).toBe("PK"); // zip
    expect(xlsx.headers.get("content-disposition")).toContain(".xlsx");
  });

  it("POST /api/export/sheets sem conta de serviço devolve 400 com instrução", async () => {
    const res = await sheets.POST(send("/api/export/sheets", "POST", { spreadsheet: "1AbCdEfGhIjKlMnOpQrStUvWxYz" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("GOOGLE_SERVICE_ACCOUNT_JSON");
  });

  it("agendamentos: cria, lista, pausa, exclui", async () => {
    const created = await schedules.POST(
      send("/api/schedules", "POST", { category: "padaria", city: "Varginha", frequency: "weekly", hour: 5 }),
    );
    expect(created.status).toBe(201);
    const s = await created.json();
    expect(s).toMatchObject({ frequency: "weekly", hour: 5, active: true, radiusKm: 10, provider: "auto", maxLeads: 500 });
    expect(new Date(s.nextRunAt).getHours()).toBe(5);

    expect((await (await schedules.GET()).json()).some((x: { id: string }) => x.id === s.id)).toBe(true);
    const off = await schedule.PATCH(send(`/api/schedules/${s.id}`, "PATCH", { active: false }), ctx(s.id));
    expect((await off.json()).active).toBe(false);
    expect((await schedule.DELETE(get("/"), ctx(s.id))).status).toBe(204);
    expect((await schedule.DELETE(get("/"), ctx(s.id))).status).toBe(404);
  });

  it("pesquisas: cria (201), lê, pausa/retoma com 409 em transição inválida", async () => {
    // provider google sem chave: o runner falha rápido, sem rede
    const created = await searches.POST(send("/api/searches", "POST", { category: "padaria", city: "Varginha", provider: "google" }));
    expect(created.status).toBe(201);
    const s = await created.json();
    expect(s).toMatchObject({ radiusKm: 10, maxLeads: 500 });

    const failed = await (async () => {
      for (let i = 0; i < 30; i++) {
        const r = await (await search.GET(get("/"), ctx(s.id))).json();
        if (r.status === "failed") return r;
        await new Promise((r2) => setTimeout(r2, 200));
      }
      throw new Error("não falhou");
    })();
    expect(failed.error).toContain("GOOGLE_PLACES_API_KEY");

    expect((await search.POST(send("/", "POST", { action: "pause" }), ctx(s.id))).status).toBe(409);
    expect((await search.POST(send("/", "POST", { action: "nope" }), ctx(s.id))).status).toBe(400);
    expect((await search.GET(get("/"), ctx("inexistente"))).status).toBe(404);

    const list = await (await searches.GET()).json();
    expect(list[0].id).toBe(s.id);
    expect((await searches.POST(send("/api/searches", "POST", { category: "x", city: "" }))).status).toBe(400);
  }, 30_000);
});
