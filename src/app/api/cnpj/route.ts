import type { NextRequest } from "next/server";
import { cnpjImportInputSchema, type CnpjStatusResponse } from "@/lib/contract";
import { db } from "@/server/db";
import { handle, parseBody } from "@/server/http";
import { IMPORT_SELECT, serializeImportInput, toCnpjImportDTO } from "@/server/cnpj/dto";
import { getCnpjRunner } from "@/server/cnpj/runner";
import { latestMonth } from "@/server/cnpj/source";
import { SITUACAO_ATIVA } from "@/server/cnpj/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const [establishments, newest, enrichedLeads, rows] = await Promise.all([
      db.cnpj.count({ where: { situacao: SITUACAO_ATIVA } }),
      db.cnpj.findFirst({ orderBy: { dumpMonth: "desc" }, select: { dumpMonth: true } }),
      db.lead.count({ where: { contactSource: { not: null } } }),
      db.cnpjImport.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: IMPORT_SELECT }),
    ]);

    const body: CnpjStatusResponse = {
      establishments,
      dumpMonth: newest?.dumpMonth ?? null,
      enrichedLeads,
      imports: rows.map(toCnpjImportDTO),
    };
    return Response.json(body);
  });
}

export function POST(req: NextRequest) {
  return handle(async () => {
    const input = await parseBody(req, cnpjImportInputSchema);
    // Sem mês informado, descobre o mais recente publicado antes de enfileirar:
    // assim a tela já mostra de qual dump a importação é.
    const dumpMonth = input.dumpMonth ?? (await latestMonth());

    const row = await db.cnpjImport.create({
      data: { dumpMonth, cities: serializeImportInput(input) },
      select: IMPORT_SELECT,
    });
    getCnpjRunner().kick();
    return Response.json(toCnpjImportDTO(row), { status: 201 });
  });
}
