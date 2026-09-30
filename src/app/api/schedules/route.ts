import type { NextRequest } from "next/server";
import { scheduleInputSchema } from "@/lib/contract";
import { db } from "@/server/db";
import { handle, parseBody } from "@/server/http";
import { SCHEDULE_SELECT, toScheduleDTO } from "@/server/leads/dto";
import { firstRunAt } from "@/server/jobs/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const rows = await db.schedule.findMany({ orderBy: { createdAt: "desc" }, select: SCHEDULE_SELECT });
    return Response.json(rows.map(toScheduleDTO));
  });
}

export function POST(req: NextRequest) {
  return handle(async () => {
    const input = await parseBody(req, scheduleInputSchema);
    const row = await db.schedule.create({
      data: {
        category: input.category,
        keywords: input.keywords || null,
        city: input.city,
        state: input.state || null,
        radiusKm: input.radiusKm,
        provider: input.provider,
        maxLeads: input.maxLeads,
        frequency: input.frequency,
        hour: input.hour,
        active: input.active,
        nextRunAt: firstRunAt(input.hour, new Date()),
      },
      select: SCHEDULE_SELECT,
    });
    return Response.json(toScheduleDTO(row), { status: 201 });
  });
}
