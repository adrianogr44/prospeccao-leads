import type { NextRequest } from "next/server";
import { searchActionSchema } from "@/lib/contract";
import { db } from "@/server/db";
import { handle, HttpError, parseBody, type IdContext } from "@/server/http";
import { getRunner } from "@/server/jobs/runner";
import { SEARCH_SELECT, toSearchDTO } from "@/server/leads/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function load(id: string) {
  const row = await db.search.findUnique({ where: { id }, select: SEARCH_SELECT });
  if (!row) throw new HttpError(404, "Pesquisa não encontrada.");
  return row;
}

export function GET(_req: NextRequest, { params }: IdContext) {
  return handle(async () => Response.json(toSearchDTO(await load((await params).id))));
}

/** pause: para ao fim da célula atual. resume: volta para a fila e continua do cursor salvo. */
export function POST(req: NextRequest, { params }: IdContext) {
  return handle(async () => {
    const { id } = await params;
    const { action } = await parseBody(req, searchActionSchema);

    // Transição condicional: evita corrida com o runner.
    const from = action === "pause" ? ["queued", "running"] : ["paused", "failed"];
    const to = action === "pause" ? "paused" : "queued";
    const changed = await db.search.updateMany({
      where: { id, status: { in: from } },
      data: action === "resume" ? { status: to, error: null, finishedAt: null } : { status: to },
    });

    const row = await load(id);
    if (changed.count === 0) {
      throw new HttpError(
        409,
        action === "pause" ? "Só dá para pausar uma pesquisa na fila ou em andamento." : "Só dá para retomar uma pesquisa pausada ou que falhou.",
      );
    }
    if (action === "resume") getRunner().kick();
    return Response.json(toSearchDTO(row));
  });
}
