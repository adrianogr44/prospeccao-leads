"use client";

import type { LeadFilters, StatsResponse } from "@/lib/contract";
import { formatNumber } from "@/lib/format";
import { Skeleton } from "../ui";

interface CardDef {
  id: string;
  label: string;
  value: (stats: StatsResponse) => number;
  /** Filtro que o card aplica ao ser clicado. */
  patch: Partial<LeadFilters>;
  isActive: (filters: LeadFilters) => boolean;
}

const CARD_KEYS = ["hasSite", "hasWhatsapp", "minStars"] as const;

export const CARDS: CardDef[] = [
  {
    id: "total",
    label: "Total",
    value: (s) => s.total,
    patch: { hasSite: undefined, hasWhatsapp: undefined, minStars: undefined },
    isActive: (f) => CARD_KEYS.every((key) => f[key] === undefined),
  },
  {
    id: "sem-site",
    label: "Sem site",
    value: (s) => s.withoutSite,
    patch: { hasSite: "no" },
    isActive: (f) => f.hasSite === "no",
  },
  {
    id: "com-site",
    label: "Com site",
    value: (s) => s.withSite,
    patch: { hasSite: "yes" },
    isActive: (f) => f.hasSite === "yes",
  },
  {
    id: "com-whatsapp",
    label: "Com WhatsApp",
    value: (s) => s.withWhatsapp,
    patch: { hasWhatsapp: "yes" },
    isActive: (f) => f.hasWhatsapp === "yes",
  },
  {
    id: "sem-whatsapp",
    label: "Sem WhatsApp",
    value: (s) => s.withoutWhatsapp,
    patch: { hasWhatsapp: "no" },
    isActive: (f) => f.hasWhatsapp === "no",
  },
  {
    id: "oportunidades",
    label: "Oportunidades 5★",
    value: (s) => s.hotLeads,
    patch: { minStars: 5 },
    isActive: (f) => f.minStars === 5,
  },
];

function clearPatch(patch: Partial<LeadFilters>): Partial<LeadFilters> {
  const cleared: Partial<LeadFilters> = {};
  for (const key of Object.keys(patch) as Array<keyof LeadFilters>) cleared[key] = undefined;
  return cleared;
}

export function StatCards({
  stats,
  filters,
  loading,
  onApply,
}: {
  stats: StatsResponse | undefined;
  filters: LeadFilters;
  loading: boolean;
  onApply: (patch: Partial<LeadFilters>) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Indicadores"
      aria-busy={loading}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
    >
      {CARDS.map((card) => {
        const active = card.isActive(filters);
        const isTotal = card.id === "total";
        return (
          <button
            key={card.id}
            type="button"
            aria-pressed={isTotal ? undefined : active}
            onClick={() =>
              // clicar de novo em um card ativo remove o filtro dele
              onApply(active && !isTotal ? clearPatch(card.patch) : card.patch)
            }
            className="rounded-lg border border-line p-3 text-left transition-colors hover:bg-surface aria-pressed:border-accent aria-pressed:bg-surface"
          >
            <span className="block text-xs text-muted">{card.label}</span>
            <span className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums">
              {stats ? formatNumber(card.value(stats)) : <Skeleton className="mt-2 h-6 w-16" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
