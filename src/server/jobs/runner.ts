import type { ProviderChoice } from "@/lib/contract";
import { db } from "../db";
import { enrichLeads } from "../enrich/enrich-lead";
import { normalizePlace } from "../leads/normalize";
import { upsertPlaces } from "../leads/upsert";
import { geocodeCity } from "../providers/geocode";
import { boundsAround, canSplit, parseCursor, serializeCursor, splitCell, type SearchCursor } from "../providers/grid";
import { resolveProvider } from "../providers";
import { ProviderError, type Cell } from "../providers/types";

const GENERIC_ERROR = "Ocorreu um erro inesperado durante a pesquisa. Tente novamente; se repetir, veja o terminal do sistema.";

/**
 * Fila em processo: uma pesquisa por vez. O estado (status e cursor) vive no banco,
 * então pausa, erro ou reinício do servidor retomam da fila de células salva.
 */
class Runner {
  private busy = false;
  private again = false;

  /** Pesquisas que estavam `running` quando o servidor caiu voltam para a fila. */
  async recover(): Promise<void> {
    await db.search.updateMany({ where: { status: "running" }, data: { status: "queued" } });
    this.kick();
  }

  /** Acorda o laço; seguro chamar várias vezes. */
  kick(): void {
    this.again = true;
    if (this.busy) return;
    void this.loop().catch((err) => console.error("[runner] laço interrompido:", err));
  }

  private async loop(): Promise<void> {
    this.busy = true;
    try {
      while (this.again) {
        this.again = false;
        for (;;) {
          const next = await db.search.findFirst({
            where: { status: "queued" },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          });
          if (!next) break;
          await this.run(next.id);
        }
      }
    } finally {
      this.busy = false;
    }
  }

  private async run(id: string): Promise<void> {
    // Só assume se ainda estiver na fila (pode ter sido pausada entre a busca e aqui).
    const claimed = await db.search.updateMany({
      where: { id, status: "queued" },
      data: { status: "running", error: null, startedAt: new Date() },
    });
    if (claimed.count === 0) return;

    try {
      await this.process(id);
    } catch (err) {
      const message = err instanceof ProviderError ? err.message : GENERIC_ERROR;
      if (!(err instanceof ProviderError)) console.error(`[runner] pesquisa ${id} falhou:`, err);
      await db.search.updateMany({
        where: { id, status: "running" },
        data: { status: "failed", error: message, finishedAt: new Date() },
      });
    }
  }

  private async process(id: string): Promise<void> {
    const search = await db.search.findUniqueOrThrow({ where: { id } });
    const provider = resolveProvider(search.provider as ProviderChoice);

    let cursor: SearchCursor | null = parseCursor(search.cursor);
    if (!cursor) {
      const center = await geocodeCity(search.city, search.state);
      cursor = { pending: [{ ...boundsAround(center.lat, center.lng, search.radiusKm), depth: 0 }], done: 0 };
      await db.search.update({ where: { id }, data: { cursor: serializeCursor(cursor) }, select: { id: true } });
    }

    let found = search.foundCount;
    while (cursor.pending.length > 0 && found < search.maxLeads) {
      const cell: Cell = cursor.pending[0];
      const result = await provider.fetchCell({
        cell,
        category: search.category,
        keywords: search.keywords,
        city: search.city,
        state: search.state,
      });

      const remaining = Math.max(search.maxLeads - found, 0);
      const places = result.places.flatMap((raw) => normalizePlace(raw) ?? []).slice(0, remaining);
      const stats = await upsertPlaces(id, places);
      const enriched = await enrichLeads(stats.leadIds);
      found += stats.found;

      const rest = cursor.pending.slice(1);
      const children: Cell[] = result.saturated && canSplit(cell) ? splitCell(cell) : [];
      const reachedLimit = found >= search.maxLeads;
      cursor = { pending: reachedLimit ? [] : [...rest, ...children], done: cursor.done + 1 };

      // Cursor e contadores são gravados a cada célula concluída.
      const current = await db.search.update({
        where: { id },
        data: {
          cursor: serializeCursor(cursor),
          foundCount: { increment: stats.found },
          newCount: { increment: stats.created },
          updatedCount: { increment: stats.updated },
          requestCount: { increment: result.requests },
          enrichedCount: { increment: enriched },
        },
        select: { status: true },
      });
      // Pausa cooperativa: se deixou de estar `running`, para (o cursor já está salvo).
      if (current.status !== "running") return;
    }

    await db.search.updateMany({
      where: { id, status: "running" },
      data: { status: "done", finishedAt: new Date() },
    });
  }
}

interface RunnerGlobal {
  __prospeccaoRunner?: Runner;
  __prospeccaoRunnerStarted?: boolean;
}
const g = globalThis as RunnerGlobal;

/** Singleton em globalThis: sobrevive ao hot reload. */
export function getRunner(): Runner {
  g.__prospeccaoRunner ??= new Runner();
  return g.__prospeccaoRunner;
}

/** Chamado pelo instrumentation ao subir o servidor (uma vez por processo). */
export async function startRunner(): Promise<void> {
  if (g.__prospeccaoRunnerStarted) return;
  g.__prospeccaoRunnerStarted = true;
  await getRunner().recover();
}
