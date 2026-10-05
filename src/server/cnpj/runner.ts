/**
 * Fila da importação de CNPJ: uma por vez, mesmo desenho do runner da pesquisa
 * (`jobs/runner.ts`). O estado vive no banco, então pausa, erro ou queda do servidor
 * retomam da etapa e da parte salvas no cursor.
 */
import { db } from "../db";
import { enrichRound, resolveLeadCities } from "./enrich";
import {
  initialCursor,
  parseCursor,
  resolveParts,
  serializeCursor,
  type ImportCursor,
} from "./cursor";
import { importEstabelecimentos, importMunicipios, importRazaoSocial } from "./import";
import { parseImportInput } from "./dto";
import { CnpjSourceError } from "./source";

const GENERIC_ERROR =
  "Ocorreu um erro inesperado na importação da base de CNPJ. Tente retomar; se repetir, veja o terminal do sistema.";

class CnpjRunner {
  private busy = false;
  private again = false;

  /** Importações que estavam `running` quando o servidor caiu voltam para a fila. */
  async recover(): Promise<void> {
    await db.cnpjImport.updateMany({ where: { status: "running" }, data: { status: "queued" } });
    this.kick();
  }

  kick(): void {
    this.again = true;
    if (this.busy) return;
    void this.loop().catch((err) => console.error("[cnpj] laço interrompido:", err));
  }

  private async loop(): Promise<void> {
    this.busy = true;
    try {
      while (this.again) {
        this.again = false;
        for (;;) {
          const next = await db.cnpjImport.findFirst({
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
    const claimed = await db.cnpjImport.updateMany({
      where: { id, status: "queued" },
      data: { status: "running", error: null, startedAt: new Date() },
    });
    if (claimed.count === 0) return;

    try {
      await this.process(id);
    } catch (err) {
      const message = err instanceof CnpjSourceError ? err.message : GENERIC_ERROR;
      if (!(err instanceof CnpjSourceError)) console.error(`[cnpj] importação ${id} falhou:`, err);
      await db.cnpjImport.updateMany({
        where: { id, status: "running" },
        data: { status: "failed", error: message, finishedAt: new Date() },
      });
    }
  }

  /** Grava o cursor e devolve a situação atual (para a pausa cooperativa). */
  private async save(id: string, cursor: ImportCursor, counters: Record<string, { increment: number }> = {}) {
    const row = await db.cnpjImport.update({
      where: { id },
      data: { cursor: serializeCursor(cursor), ...counters },
      select: { status: true },
    });
    return row.status;
  }

  private async process(id: string): Promise<void> {
    const job = await db.cnpjImport.findUniqueOrThrow({ where: { id } });
    const input = parseImportInput(job.cities);
    const parts = resolveParts(input.parts);

    const fresh = initialCursor(parts, input.skipDump);
    let cursor: ImportCursor = parseCursor(job.cursor) ?? fresh;

    // Etapa 1: tabela de municípios e códigos das cidades pedidas.
    if (cursor.stage === "municipios") {
      const resolved = await importMunicipios(job.dumpMonth, input.cities);
      cursor = { ...fresh, ...resolved, stage: "dump" };
      if ((await this.save(id, cursor)) !== "running") return;
    }

    const paused = async () =>
      (await db.cnpjImport.findUnique({ where: { id }, select: { status: true } }))?.status !== "running";

    // Etapa 2a: estabelecimentos dos municípios pedidos, parte por parte.
    while (cursor.stage === "dump" && cursor.pending.length > 0) {
      const part = cursor.pending[0];
      const result = await importEstabelecimentos(job.dumpMonth, part, cursor.codes, cursor.ufs, paused);
      await db.cnpjImport.update({
        where: { id },
        data: { scannedCount: { increment: result.scanned }, savedCount: { increment: result.saved } },
        select: { id: true },
      });
      // Pausa no meio de uma parte: a parte continua pendente e é lida do começo ao retomar.
      if (result.stopped) return;

      cursor = { ...cursor, pending: cursor.pending.slice(1) };
      if ((await this.save(id, cursor)) !== "running") return;
    }

    // Etapa 2b: razão social, lendo as 10 partes de Empresas.
    while (cursor.stage === "dump" && cursor.pendingEmpresas.length > 0) {
      await importRazaoSocial(job.dumpMonth, cursor.pendingEmpresas[0]);
      cursor = { ...cursor, pendingEmpresas: cursor.pendingEmpresas.slice(1) };
      if ((await this.save(id, cursor)) !== "running") return;
    }

    if (cursor.stage === "dump") {
      cursor = { ...cursor, stage: "enrich", enrichAfterId: null };
      if ((await this.save(id, cursor)) !== "running") return;
    }

    // Etapa 3: cruzamento com os leads.
    const leadCities = await resolveLeadCities(input.cities.map((c) => c.city));
    for (;;) {
      const round = await enrichRound(leadCities, cursor.codes, cursor.ufs, job.dumpMonth, cursor.enrichAfterId);
      cursor = { ...cursor, enrichAfterId: round.afterId };
      const status = await this.save(id, cursor, {
        examinedCount: { increment: round.stats.examined },
        matchedCount: { increment: round.stats.matched },
        phoneCount: { increment: round.stats.phone },
        emailCount: { increment: round.stats.email },
        ambiguousCount: { increment: round.stats.ambiguous },
      });
      if (status !== "running") return;
      if (round.finished) break;
    }

    await db.cnpjImport.updateMany({
      where: { id, status: "running" },
      data: { status: "done", finishedAt: new Date() },
    });
  }
}

interface CnpjRunnerGlobal {
  __prospeccaoCnpjRunner?: CnpjRunner;
  __prospeccaoCnpjRunnerStarted?: boolean;
}
const g = globalThis as CnpjRunnerGlobal;

/** Singleton em globalThis: sobrevive ao hot reload. */
export function getCnpjRunner(): CnpjRunner {
  g.__prospeccaoCnpjRunner ??= new CnpjRunner();
  return g.__prospeccaoCnpjRunner;
}

/** Chamado pelo instrumentation ao subir o servidor (uma vez por processo). */
export async function startCnpjRunner(): Promise<void> {
  if (g.__prospeccaoCnpjRunnerStarted) return;
  g.__prospeccaoCnpjRunnerStarted = true;
  await getCnpjRunner().recover();
}
