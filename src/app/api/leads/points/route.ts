import type { NextRequest } from "next/server";
import { LEAD_POINTS_LIMIT, leadFiltersSchema, type LeadPointsResponse, type SiteStatus } from "@/lib/contract";
import { db } from "@/server/db";
import { handle, parseQuery } from "@/server/http";
import { buildLeadWhere } from "@/server/leads/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pontos do mapa: só o necessário para desenhar, para todos os leads do filtro (não só a página atual). */
export function GET(req: NextRequest) {
  return handle(async () => {
    const filters = parseQuery(req, leadFiltersSchema);
    const where = { AND: [buildLeadWhere(filters), { lat: { not: null }, lng: { not: null } }] };
    const [total, rows] = await Promise.all([
      db.lead.count({ where }),
      db.lead.findMany({
        where,
        orderBy: [{ score: "desc" }, { id: "asc" }],
        take: LEAD_POINTS_LIMIT,
        select: {
          id: true,
          name: true,
          lat: true,
          lng: true,
          score: true,
          stars: true,
          siteStatus: true,
          contactedAt: true,
        },
      }),
    ]);
    const body: LeadPointsResponse = {
      points: rows.flatMap((r) =>
        r.lat === null || r.lng === null
          ? []
          : [
              {
                id: r.id,
                name: r.name,
                lat: r.lat,
                lng: r.lng,
                score: r.score,
                stars: r.stars,
                siteStatus: r.siteStatus as SiteStatus,
                contacted: r.contactedAt !== null,
              },
            ],
      ),
      total,
      truncated: total > LEAD_POINTS_LIMIT,
    };
    return Response.json(body);
  });
}
