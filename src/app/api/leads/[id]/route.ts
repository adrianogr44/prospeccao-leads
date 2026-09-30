import type { NextRequest } from "next/server";
import { leadPatchSchema } from "@/lib/contract";
import { db } from "@/server/db";
import { handle, HttpError, noContent, parseBody, type IdContext } from "@/server/http";
import { LEAD_SELECT, toLeadDTO } from "@/server/leads/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function PATCH(req: NextRequest, { params }: IdContext) {
  return handle(async () => {
    const { id } = await params;
    const { notes, contacted } = await parseBody(req, leadPatchSchema);
    const row = await db.lead.update({
      where: { id },
      data: {
        ...(notes !== undefined && { notes: notes?.trim() ? notes.trim() : null }),
        ...(contacted !== undefined && { contactedAt: contacted ? new Date() : null }),
      },
      select: LEAD_SELECT,
    });
    return Response.json(toLeadDTO(row));
  });
}

/** Exclui e bloqueia a reimportação (pedido de remoção, LGPD). */
export function DELETE(_req: NextRequest, { params }: IdContext) {
  return handle(async () => {
    const { id } = await params;
    await db.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id }, select: { source: true, externalId: true } });
      if (!lead) throw new HttpError(404, "Lead não encontrado.");
      await tx.blocked.upsert({ where: { source_externalId: lead }, create: lead, update: {} });
      await tx.lead.delete({ where: { id } });
    });
    return noContent();
  });
}
