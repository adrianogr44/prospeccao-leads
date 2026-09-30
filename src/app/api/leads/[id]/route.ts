import type { NextRequest } from "next/server";
import { leadPatchSchema, type SiteStatus } from "@/lib/contract";
import { normalizePhoneBR } from "@/lib/outreach";
import { db } from "@/server/db";
import { handle, HttpError, noContent, parseBody, type IdContext } from "@/server/http";
import { LEAD_SELECT, parseStringArray, toLeadDTO } from "@/server/leads/dto";
import { scoreColumns } from "@/server/leads/upsert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_req: NextRequest, { params }: IdContext) {
  return handle(async () => {
    const { id } = await params;
    const row = await db.lead.findUnique({ where: { id }, select: LEAD_SELECT });
    if (!row) throw new HttpError(404, "Lead não encontrado.");
    return Response.json(toLeadDTO(row));
  });
}

export function PATCH(req: NextRequest, { params }: IdContext) {
  return handle(async () => {
    const { id } = await params;
    const { notes, contacted, whatsapp } = await parseBody(req, leadPatchSchema);
    const row = await db.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          ...(notes !== undefined && { notes: notes?.trim() ? notes.trim() : null }),
          ...(contacted !== undefined && { contactedAt: contacted ? new Date() : null }),
          ...(whatsapp !== undefined && { whatsapp: whatsapp ? normalizePhoneBR(whatsapp) : null }),
        },
        select: LEAD_SELECT,
      });
      if (whatsapp === undefined) return updated;
      // O WhatsApp entra no score: recalcula agora para não divergir da próxima pesquisa.
      return tx.lead.update({
        where: { id },
        data: scoreColumns({
          source: updated.source,
          siteStatus: updated.siteStatus as SiteStatus,
          siteSignals: parseStringArray(updated.siteSignals),
          rating: updated.rating,
          reviewCount: updated.reviewCount,
          whatsapp: updated.whatsapp,
          instagram: updated.instagram,
          businessStatus: updated.businessStatus,
        }),
        select: LEAD_SELECT,
      });
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
