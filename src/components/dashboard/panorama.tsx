"use client";

import { SITE_STATUSES, SITE_STATUS_LABEL, type LeadFilters, type SiteStatus, type StatsResponse } from "@/lib/contract";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/format";
import { THERMO_LABEL } from "../lead-ui";
import { Skeleton } from "../ui";

// Distribuições em barras horizontais finas (substituem a rosca e as barras do Chart.js).
// Cada linha é um botão que alterna um filtro; usam os números da fila atual.

interface Row {
  key: string;
  label: string;
  count: number;
  fill: string;
  active: boolean;
  onToggle: () => void;
  /** Nome acessível do botão (o texto visível já traz rótulo e contagem). */
  hint?: string;
}

const SITE_FILL: Record<SiteStatus, string> = {
  NONE: "bg-amber",
  SOCIAL_ONLY: "bg-amber/70",
  OLD: "bg-amber/45",
  UNREACHABLE: "bg-pin",
  OK: "bg-fog",
  UNKNOWN: "bg-fog/40",
};

const THERMO_FILL: Record<number, string> = {
  5: "bg-[var(--termo-5)]",
  4: "bg-[var(--termo-4)]",
  3: "bg-[var(--termo-3)]",
  2: "bg-[var(--termo-2)]",
  1: "bg-[var(--termo-1)]",
};

function Block({ title, rows }: { title: string; rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const anyActive = rows.some((r) => r.active);
  return (
    <section>
      <h3 className="rotulo mb-1.5 px-2">{title}</h3>
      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              aria-pressed={row.active}
              title={row.hint}
              onClick={row.onToggle}
              className="group grid h-7 w-full grid-cols-[35%_1fr_40px] items-center gap-3 rounded-control px-2 text-left transicao hover:bg-hover"
            >
              <span className={cx("truncate text-botao", row.active ? "font-medium text-fg" : "text-muted")}>
                {row.label}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-selected">
                <span
                  className={cx(
                    "block h-full rounded-full transicao",
                    row.active ? "bg-amber" : row.fill,
                    anyActive && !row.active && "opacity-50",
                    !row.active && "group-hover:brightness-125",
                  )}
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </span>
              <span className="text-right font-display text-botao font-semibold text-fg tabular-nums">{formatNumber(row.count)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Panorama({
  stats,
  filters,
  onChange,
}: {
  stats: StatsResponse | undefined;
  filters: LeadFilters;
  onChange: (patch: Partial<LeadFilters>) => void;
}) {
  if (!stats) {
    return (
      <div aria-hidden="true" className="space-y-5 px-2">
        {[5, 4, 3].map((n) => (
          <div key={n} className="space-y-2.5">
            <Skeleton className="h-3 w-24" />
            {Array.from({ length: n }, (_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (stats.total === 0) return <p className="px-2 text-muted">Sem dados para o filtro atual.</p>;

  const byStars = new Map(stats.byStars.map((s) => [Number(s.label), s.count]));
  const thermoRows: Row[] = [5, 4, 3, 2, 1].map((level) => {
    // Nível N grava minStars=N ("a partir de"); o mais baixo remove o filtro.
    const active = level === 1 ? false : filters.minStars === level;
    return {
      key: String(level),
      label: THERMO_LABEL[level],
      count: byStars.get(level) ?? 0,
      fill: THERMO_FILL[level],
      active,
      hint: level === 1 ? "Mostrar todas as oportunidades" : `Filtrar a partir de ${THERMO_LABEL[level]}`,
      onToggle: () => onChange({ minStars: level === 1 || active ? undefined : level }),
    };
  });

  const siteCount = new Map(stats.bySiteStatus.map((s) => [s.label, s.count]));
  const siteRows: Row[] = SITE_STATUSES.filter((s) => (siteCount.get(s) ?? 0) > 0).map((status) => {
    const active = filters.siteStatus === status;
    return {
      key: status,
      label: SITE_STATUS_LABEL[status],
      count: siteCount.get(status) ?? 0,
      fill: SITE_FILL[status],
      active,
      onToggle: () => onChange({ siteStatus: active ? undefined : status }),
    };
  });

  const listRows = (items: StatsResponse["byCity"], key: "city" | "category"): Row[] =>
    items.map((item) => {
      const active = filters[key] === item.label;
      return {
        key: item.label,
        label: item.label,
        count: item.count,
        fill: "bg-fog",
        active,
        onToggle: () => onChange({ [key]: active ? undefined : item.label }),
      };
    });

  return (
    <div className="space-y-5">
      <Block title="Termômetro" rows={thermoRows} />
      {siteRows.length > 0 && <Block title="Situação do site" rows={siteRows} />}
      {stats.byCity.length >= 2 && <Block title="Cidades" rows={listRows(stats.byCity, "city")} />}
      {stats.byCategory.length >= 2 && <Block title="Categorias" rows={listRows(stats.byCategory, "category")} />}
    </div>
  );
}
