import type { MetaResponse } from "@/lib/contract";
import { googlePlacesKey, serviceAccount } from "@/server/config";
import { db } from "@/server/db";
import { handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const [cities, states, categories] = await Promise.all([
      db.lead.findMany({ where: { city: { not: null } }, distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } }),
      db.lead.findMany({ where: { state: { not: null } }, distinct: ["state"], select: { state: true }, orderBy: { state: "asc" } }),
      db.lead.findMany({
        where: { category: { not: null } },
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
      }),
    ]);
    const account = serviceAccount();
    const body: MetaResponse = {
      cities: cities.flatMap((r) => (r.city ? [r.city] : [])),
      states: states.flatMap((r) => (r.state ? [r.state] : [])),
      categories: categories.flatMap((r) => (r.category ? [r.category] : [])),
      config: {
        googlePlaces: googlePlacesKey() !== null,
        googleSheets: account !== null,
        serviceAccountEmail: account?.email ?? null,
      },
    };
    return Response.json(body);
  });
}
