import type { NextRequest } from "next/server";
import { leadFiltersSchema } from "@/lib/contract";
import { handle, parseQuery } from "@/server/http";
import { getStats } from "@/server/leads/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handle(async () => Response.json(await getStats(parseQuery(req, leadFiltersSchema))));
}
