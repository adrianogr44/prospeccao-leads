import type { NextRequest } from "next/server";
import { leadListQuerySchema, type LeadListResponse } from "@/lib/contract";
import { db } from "@/server/db";
import { handle, parseQuery } from "@/server/http";
import { LEAD_SELECT, toLeadDTO } from "@/server/leads/dto";
import { buildLeadOrderBy, buildLeadWhere } from "@/server/leads/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handle(async () => {
    const query = parseQuery(req, leadListQuerySchema);
    const where = buildLeadWhere(query);
    const [total, rows] = await Promise.all([
      db.lead.count({ where }),
      db.lead.findMany({
        where,
        orderBy: buildLeadOrderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: LEAD_SELECT,
      }),
    ]);
    const body: LeadListResponse = { items: rows.map(toLeadDTO), total, page: query.page, pageSize: query.pageSize };
    return Response.json(body);
  });
}
