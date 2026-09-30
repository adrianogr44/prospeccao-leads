import type { NextRequest } from "next/server";
import { searchInputSchema } from "@/lib/contract";
import { db } from "@/server/db";
import { handle, parseBody } from "@/server/http";
import { SEARCH_SELECT, toSearchDTO } from "@/server/leads/dto";
import { getRunner } from "@/server/jobs/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const rows = await db.search.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: SEARCH_SELECT });
    return Response.json(rows.map(toSearchDTO));
  });
}

export function POST(req: NextRequest) {
  return handle(async () => {
    const input = await parseBody(req, searchInputSchema);
    const row = await db.search.create({
      data: {
        category: input.category,
        keywords: input.keywords || null,
        city: input.city,
        state: input.state || null,
        radiusKm: input.radiusKm,
        provider: input.provider,
        maxLeads: input.maxLeads,
      },
      select: SEARCH_SELECT,
    });
    getRunner().kick();
    return Response.json(toSearchDTO(row), { status: 201 });
  });
}
