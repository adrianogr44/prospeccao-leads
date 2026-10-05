import type { NextRequest } from "next/server";
import { cnpjImportActionSchema } from "@/lib/contract";
import { db } from "@/server/db";
import { handle, HttpError, parseBody, type IdContext } from "@/server/http";
import { IMPORT_SELECT, toCnpjImportDTO } from "@/server/cnpj/dto";
import { getCnpjRunner } from "@/server/cnpj/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function load(id: string) {
  const row = await db.cnpjImport.findUnique({ where: { id }, select: IMPORT_SELECT });
  if (!row) throw new HttpError(404, "Importação não encontrada.");
  return row;
}

export function GET(_req: NextRequest, { params }: IdContext) {
  return handle(async () => Response.json(toCnpjImportDTO(await load((await params).id))));
}

/** pause: para no fim do lote atual. resume: volta para a fila e continua do cursor salvo. */
export function POST(req: NextRequest, { params }: IdContext) {
  return handle(async () => {
    const { id } = await params;
    const { action } = await parseBody(req, cnpjImportActionSchema);

    // Transição condicional: evita corrida com o runner.
    const from = action === "pause" ? ["queued", "running"] : ["paused", "failed"];
    const to = action === "pause" ? "paused" : "queued";
    const changed = await db.cnpjImport.updateMany({
      where: { id, status: { in: from } },
      data: action === "resume" ? { status: to, error: null, finishedAt: null } : { status: to },
    });

    const row = await load(id);
    if (changed.count === 0) {
      throw new HttpError(
        409,
        action === "pause"
          ? "Só dá para pausar uma importação na fila ou em andamento."
          : "Só dá para retomar uma importação pausada ou que falhou.",
      );
    }
    if (action === "resume") getCnpjRunner().kick();
    return Response.json(toCnpjImportDTO(row));
  });
}
