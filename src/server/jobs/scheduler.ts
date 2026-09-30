import type { Frequency } from "@/lib/contract";
import { db } from "../db";
import { getRunner } from "./runner";

const TICK_MS = 60_000;

/** Próxima ocorrência de `hour`:00 (hora local do servidor) estritamente depois de `from`. */
export function firstRunAt(hour: number, from: Date): Date {
  const slot = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hour, 0, 0, 0);
  if (slot.getTime() <= from.getTime()) slot.setDate(slot.getDate() + 1);
  return slot;
}

/** Próxima execução depois de uma execução em `from`: +1 dia, +7 dias ou +1 mês, sempre em `hour`:00. */
export function nextRunAfter(frequency: Frequency, hour: number, from: Date): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const d = from.getDate();
  switch (frequency) {
    case "daily":
      return firstRunAt(hour, from);
    case "weekly":
      return new Date(y, m, d + 7, hour, 0, 0, 0);
    case "monthly": {
      const candidate = new Date(y, m + 1, d, hour, 0, 0, 0);
      // Dia 31 num mês de 30 dias transborda para o mês seguinte: usa o último dia do mês desejado.
      return candidate.getMonth() === (m + 1) % 12 ? candidate : new Date(y, m + 2, 0, hour, 0, 0, 0);
    }
  }
}

/** Cria uma pesquisa para cada agendamento vencido e recalcula `nextRunAt`. */
export async function runDueSchedules(now = new Date()): Promise<number> {
  const due = await db.schedule.findMany({
    where: { active: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: 20,
  });

  let created = 0;
  for (const s of due) {
    // Reivindica pelo nextRunAt lido: se outra execução já avançou, count = 0 e não duplica.
    const ok = await db.$transaction(async (tx) => {
      const claim = await tx.schedule.updateMany({
        where: { id: s.id, active: true, nextRunAt: s.nextRunAt },
        data: { lastRunAt: now, nextRunAt: nextRunAfter(s.frequency as Frequency, s.hour, now) },
      });
      if (claim.count === 0) return false;
      await tx.search.create({
        data: {
          category: s.category,
          keywords: s.keywords,
          city: s.city,
          state: s.state,
          radiusKm: s.radiusKm,
          provider: s.provider,
          maxLeads: s.maxLeads,
          scheduleId: s.id,
        },
        select: { id: true },
      });
      return true;
    });
    if (ok) created++;
  }
  if (created > 0) getRunner().kick();
  return created;
}

interface SchedulerGlobal {
  __prospeccaoScheduler?: NodeJS.Timeout;
}
const g = globalThis as SchedulerGlobal;

/** Liga o agendador (uma vez por processo, sobrevive ao hot reload). */
export function startScheduler(): void {
  if (g.__prospeccaoScheduler) return;
  const tick = () => runDueSchedules().catch((err) => console.error("[scheduler] falha:", err));
  g.__prospeccaoScheduler = setInterval(tick, TICK_MS);
  g.__prospeccaoScheduler.unref();
  void tick();
}
