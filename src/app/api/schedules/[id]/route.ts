import type { NextRequest } from "next/server";
import { schedulePatchSchema } from "@/lib/contract";
import { db } from "@/server/db";
import { handle, HttpError, noContent, parseBody, type IdContext } from "@/server/http";
import { SCHEDULE_SELECT, toScheduleDTO } from "@/server/leads/dto";
import { firstRunAt } from "@/server/jobs/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function PATCH(req: NextRequest, { params }: IdContext) {
  return handle(async () => {
    const { id } = await params;
    const { active } = await parseBody(req, schedulePatchSchema);
    const current = await db.schedule.findUnique({ where: { id }, select: { hour: true, active: true } });
    if (!current) throw new HttpError(404, "Agendamento não encontrado.");

    // Reativar recalcula o próximo horário para não disparar imediatamente um horário vencido.
    const reactivating = active && !current.active;
    const row = await db.schedule.update({
      where: { id },
      data: { active, ...(reactivating ? { nextRunAt: firstRunAt(current.hour, new Date()) } : {}) },
      select: SCHEDULE_SELECT,
    });
    return Response.json(toScheduleDTO(row));
  });
}

export function DELETE(_req: NextRequest, { params }: IdContext) {
  return handle(async () => {
    const { id } = await params;
    await db.schedule.delete({ where: { id } }); // P2025 vira 404 em handle()
    return noContent();
  });
}
