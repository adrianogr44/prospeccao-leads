"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { StatsResponse } from "@/lib/contract";
import { ChevronDownIcon, ChevronUpIcon } from "../icons";
import { Button, Skeleton } from "../ui";

// Chart.js só é baixado quando os gráficos aparecem.
const ChartsCanvas = dynamic(() => import("./charts-canvas"), {
  ssr: false,
  loading: () => <ChartsSkeleton />,
});

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-64" />
      ))}
    </div>
  );
}

export function Charts({ stats }: { stats: StatsResponse | undefined }) {
  const [open, setOpen] = useState(true);

  return (
    <section aria-labelledby="graficos-titulo" className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="graficos-titulo" className="text-sm font-semibold">
          Gráficos
        </h2>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-controls="graficos-painel"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
          {open ? "Recolher" : "Mostrar"}
        </Button>
      </div>
      <div id="graficos-painel" hidden={!open}>
        {open && (stats ? <ChartsCanvas stats={stats} /> : <ChartsSkeleton />)}
      </div>
    </section>
  );
}
