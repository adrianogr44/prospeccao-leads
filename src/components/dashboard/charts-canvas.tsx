"use client";

import type { ReactNode } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { SITE_STATUS_LABEL, type CountBy, type SiteStatus, type StatsResponse } from "@/lib/contract";
import { formatNumber } from "@/lib/format";
import { useIsDark } from "../theme-toggle";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface Palette {
  fg: string;
  muted: string;
  line: string;
  accent: string;
  accentSoft: string;
  warn: string;
  danger: string;
}

/** Lê as cores dos tokens CSS; recalcula quando o tema muda. */
function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string) => css.getPropertyValue(name).trim();
  return {
    fg: get("--fg"),
    muted: get("--muted"),
    line: get("--line"),
    accent: get("--accent"),
    accentSoft: get("--accent-soft"),
    warn: get("--warn"),
    danger: get("--danger"),
  };
}

function usePalette(): Palette {
  useIsDark(); // assina a troca de tema: o componente renderiza de novo e relê os tokens
  return readPalette();
}

const isSiteStatus = (label: string): label is SiteStatus => label in SITE_STATUS_LABEL;
const siteLabel = (label: string) => (isSiteStatus(label) ? SITE_STATUS_LABEL[label] : label);

function siteColor(label: string, p: Palette): string {
  if (!isSiteStatus(label)) return p.line;
  const colors: Record<SiteStatus, string> = {
    NONE: p.accent,
    SOCIAL_ONLY: p.accentSoft,
    OLD: p.warn,
    UNREACHABLE: p.danger,
    OK: p.muted,
    UNKNOWN: p.line,
  };
  return colors[label];
}

function summary(title: string, items: CountBy[], format: (label: string) => string = (l) => l): string {
  const list = items.map((i) => `${format(i.label)}: ${formatNumber(i.count)}`).join("; ");
  return `${title}. ${list || "Sem dados"}`;
}

function barOptions(p: Palette, horizontal: boolean): ChartOptions<"bar"> {
  const ticks = { color: p.muted, precision: 0 };
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? "y" : "x",
    datasets: { bar: { maxBarThickness: 36 } },
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks, grid: { color: horizontal ? p.line : "transparent" }, border: { color: p.line } },
      y: { ticks, grid: { color: horizontal ? "transparent" : p.line }, border: { color: p.line } },
    },
  };
}

function ChartCard({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return (
    <figure className="rounded-lg border border-line p-3">
      <figcaption className="mb-2 text-xs font-medium text-muted">{title}</figcaption>
      <div className="h-56" role="img" aria-label={label}>
        {children}
      </div>
    </figure>
  );
}

export default function ChartsCanvas({ stats }: { stats: StatsResponse }) {
  const p = usePalette();

  const status = stats.bySiteStatus.filter((s) => s.count > 0);
  const stars = stats.byStars;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <ChartCard title="Situação do site" label={summary("Situação do site", status, siteLabel)}>
        <Doughnut
          data={{
            labels: status.map((s) => siteLabel(s.label)),
            datasets: [
              {
                data: status.map((s) => s.count),
                backgroundColor: status.map((s) => siteColor(s.label, p)),
                borderColor: p.line,
                borderWidth: 1,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: { legend: { position: "right", labels: { color: p.fg, boxWidth: 10, boxHeight: 10 } } },
          }}
        />
      </ChartCard>
      <ChartCard title="Oportunidade (estrelas)" label={summary("Oportunidade por estrelas", stars, (l) => `${l} de 5`)}>
        <Bar
          data={{
            labels: stars.map((s) => `${s.label}★`),
            datasets: [{ data: stars.map((s) => s.count), backgroundColor: p.accent, borderRadius: 3 }],
          }}
          options={barOptions(p, false)}
        />
      </ChartCard>
      <ChartCard title="Principais cidades" label={summary("Principais cidades", stats.byCity)}>
        <Bar
          data={{
            labels: stats.byCity.map((s) => s.label),
            datasets: [{ data: stats.byCity.map((s) => s.count), backgroundColor: p.accent, borderRadius: 3 }],
          }}
          options={barOptions(p, true)}
        />
      </ChartCard>
      <ChartCard title="Principais categorias" label={summary("Principais categorias", stats.byCategory)}>
        <Bar
          data={{
            labels: stats.byCategory.map((s) => s.label),
            datasets: [{ data: stats.byCategory.map((s) => s.count), backgroundColor: p.accent, borderRadius: 3 }],
          }}
          options={barOptions(p, true)}
        />
      </ChartCard>
    </div>
  );
}
