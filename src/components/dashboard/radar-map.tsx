"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { LEAD_POINTS_LIMIT, type LeadPointsResponse } from "@/lib/contract";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/format";
import type { ApiResource } from "@/lib/use-api";
import { ChevronDownIcon, ChevronUpIcon, LocateIcon, MapIcon, MinusIcon, PlusIcon, RadarVazio, WifiOffIcon } from "../icons";
import { THERMO_LABEL } from "../lead-ui";
import { Button, IconButton, Kbd, Spinner } from "../ui";
import type { RadarMapApi, ZoomState } from "./radar-map-canvas";

// O JavaScript do Leaflet só é baixado quando o mapa abre.
const RadarMapCanvas = dynamic(() => import("./radar-map-canvas"), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-canvas">
      <Spinner label="Carregando o mapa…" />
    </div>
  );
}

// ---------- Legenda ----------

const SAMPLE: Record<number, string> = {
  5: "size-3.5 bg-[var(--termo-5)] shadow-[0_0_0_3px_rgba(245,166,35,.22),0_0_14px_3px_var(--letreiro-halo)] light:shadow-[var(--mapa-ponto-anel),0_0_0_3px_rgba(163,85,0,.18)]",
  4: "size-2.5 bg-[var(--termo-4)] opacity-92 shadow-[0_0_8px_1px_rgba(245,166,35,.32)] light:shadow-[var(--mapa-ponto-anel)]",
  3: "size-2 bg-[var(--termo-3)] opacity-75 light:shadow-[var(--mapa-ponto-anel)]",
  2: "size-1.5 bg-[var(--termo-2)] opacity-55 light:shadow-[var(--mapa-ponto-anel)]",
  1: "size-[5px] bg-[var(--termo-1)] opacity-40 light:shadow-[var(--mapa-ponto-anel)]",
};

function ContactedSample() {
  return (
    <span className="inline-flex size-2.5 items-center justify-center rounded-full bg-sent-soft shadow-[inset_0_0_0_2px_var(--envio-anel)]">
      <span className="size-[3px] rounded-full bg-[var(--envio-anel)]" />
    </span>
  );
}

function LegendItems({ withContext }: { withContext: boolean }) {
  return (
    <>
      {[5, 4, 3, 2, 1].map((level) => (
        <li key={level} className="flex items-center gap-1.5">
          <span className="flex size-3.5 items-center justify-center">
            <span className={cx("rounded-full", SAMPLE[level])} />
          </span>
          {THERMO_LABEL[level]}
        </li>
      ))}
      <li aria-hidden="true" className="h-3 w-px bg-line" />
      <li className="flex items-center gap-1.5">
        <ContactedSample />
        Contatada
      </li>
      {withContext && (
        <li className="flex items-center gap-1.5">
          <span className="size-[3px] rounded-full bg-faint" />
          Fora do filtro
        </li>
      )}
    </>
  );
}

function Legend({ withContext }: { withContext: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute bottom-3 left-3 z-[500] max-w-[calc(100%-24px)]">
      {/* Celular: um botão abre a mesma lista */}
      <div className="sm:hidden">
        <Button size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="bg-surface-2">
          Legenda
        </Button>
      </div>
      <div
        className={cx(
          "rounded-card bg-surface-2 px-2.5 py-2 shadow-elev-2",
          open ? "mt-2 block" : "hidden",
          "sm:mt-0 sm:block",
        )}
      >
        <p className="font-display text-mini font-semibold tracking-rotulo text-subtle uppercase">Oportunidade</p>
        <ul className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-legenda text-muted">
          <LegendItems withContext={withContext} />
        </ul>
      </div>
    </div>
  );
}

// ---------- Mapa ----------

export function RadarMap({
  points,
  pointsKey,
  context,
  open,
  onToggle,
  listTotal,
  selectedId,
  hoverId,
  onSelect,
  onClearFilters,
}: {
  /** Pontos do filtro atual (busca feita pelo dashboard, que também os atualiza ao enviar). */
  points: ApiResource<LeadPointsResponse>;
  /** Identidade do filtro dos pontos: muda o enquadramento quando o resultado novo chega. */
  pointsKey: string;
  /** Pontos dos filtros-base (sem etapa), só quando há etapa ativa: a "poeira" de contexto. */
  context: LeadPointsResponse | undefined;
  open: boolean;
  onToggle: () => void;
  listTotal: number | undefined;
  selectedId: string | null;
  hoverId: string | null;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}) {
  const api = useRef<RadarMapApi | null>(null);
  const [tiles, setTiles] = useState<"ok" | "offline">("ok");
  const [moved, setMoved] = useState(false);
  const [zoom, setZoom] = useState<ZoomState>({ canZoomIn: true, canZoomOut: true });

  const data = points.data;
  const total = data?.total;
  const countText =
    total === undefined
      ? " "
      : data?.truncated
        ? `Mostrando as ${formatNumber(LEAD_POINTS_LIMIT)} de maior oportunidade de ${formatNumber(total)}`
        : `${formatNumber(total)} ${total === 1 ? "ponto" : "pontos"}`;

  if (!open) {
    return (
      <div className="flex h-10 items-center justify-between gap-2 rounded-panel bg-surface pr-1 pl-3 shadow-elev-1">
        <p className="flex min-w-0 items-center gap-2 text-muted">
          <MapIcon className="size-4 shrink-0 text-subtle" />
          <span className="truncate">Mapa</span>
        </p>
        <Button variant="ghost" size="sm" onClick={onToggle} aria-expanded={false} aria-keyshortcuts="M">
          Abrir mapa
          <ChevronDownIcon />
          <span className="hidden md:contents">
            <Kbd>M</Kbd>
          </span>
        </Button>
      </div>
    );
  }

  const empty = data !== undefined && data.total === 0;
  const regionLabel = `Mapa das empresas, ${total === undefined ? "carregando" : `${formatNumber(total)} pontos`}`;

  return (
    <div className="relative overflow-hidden rounded-panel bg-surface shadow-elev-1">
      <a
        href="#depois-do-mapa"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[600] focus:m-2 focus:inline-block focus:rounded-control focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-fg"
      >
        Pular o mapa
      </a>
      <section
        aria-label={regionLabel}
        data-sem-rede={tiles === "offline" ? "true" : undefined}
        className="radar relative h-[240px] bg-canvas xl:h-[320px]"
      >
        {data && (
          <RadarMapCanvas
            points={data.points}
            context={context?.points ?? null}
            fitKey={points.loading ? null : pointsKey}
            selectedId={selectedId}
            hoverId={hoverId}
            onSelect={onSelect}
            onReady={(ready) => {
              api.current = ready;
            }}
            onTiles={setTiles}
            onMoved={setMoved}
            onZoom={setZoom}
          />
        )}

        {!data && !points.error && <MapLoading />}

        {points.error && !data && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center p-4">
            <div role="alert" className="w-[280px] rounded-card bg-surface-2 p-4 text-center shadow-elev-2">
              <p className="text-forte font-semibold">Não consegui carregar os pontos do mapa.</p>
              <p className="mt-1 text-legenda text-subtle">{points.error}</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={points.reload}>
                Tentar de novo
              </Button>
            </div>
          </div>
        )}

        {empty && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center p-4">
            <div className="flex w-[280px] flex-col items-center rounded-card bg-surface-2 p-4 text-center shadow-elev-2">
              <RadarVazio className="size-16" />
              {listTotal !== undefined && listTotal > 0 ? (
                <>
                  <p className="mt-2 text-forte font-semibold">Nenhuma empresa deste filtro tem localização no mapa.</p>
                  <p className="mt-1 text-legenda text-subtle">A lista continua mostrando todas.</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-forte font-semibold">Sem empresas para mostrar no mapa.</p>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={onClearFilters}>
                    Limpar filtros
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Faixa de "sem internet" no topo e, abaixo dela, os controles (empilhados, sem sobrepor) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col">
        {tiles === "offline" && (
          <div
            role="status"
            className="pointer-events-auto grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-x-2 border-b border-line bg-surface-2 px-3 py-2 text-legenda text-muted"
          >
            <WifiOffIcon className="size-4" />
            <p>
              <span className="block text-fg">Sem internet para carregar o mapa.</span>
              Os pontos continuam aqui, só sem o desenho das ruas.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="-my-1 -mr-2 h-7 px-2"
              onClick={() => {
                setTiles("ok");
                api.current?.retryTiles();
              }}
            >
              Tentar de novo
            </Button>
          </div>
        )}

        {data && (
          <div className="pointer-events-auto mt-3 mr-3 flex flex-col gap-2 self-end">
            <div className="flex flex-col overflow-hidden rounded-card bg-surface-2 shadow-elev-2">
              <button
                type="button"
                aria-label="Aproximar"
                title="Aproximar"
                disabled={!zoom.canZoomIn}
                onClick={() => api.current?.zoomIn()}
                className="flex size-8 items-center justify-center text-muted transicao not-disabled:hover:bg-selected not-disabled:hover:text-fg disabled:text-faint"
              >
                <PlusIcon />
              </button>
              <span aria-hidden="true" className="h-px bg-line" />
              <button
                type="button"
                aria-label="Afastar"
                title="Afastar"
                disabled={!zoom.canZoomOut}
                onClick={() => api.current?.zoomOut()}
                className="flex size-8 items-center justify-center text-muted transicao not-disabled:hover:bg-selected not-disabled:hover:text-fg disabled:text-faint"
              >
                <MinusIcon />
              </button>
            </div>
            {moved && !empty && (
              <IconButton
                label="Recentrar nos pontos"
                variant="secondary"
                className="rounded-card bg-surface-2 shadow-elev-2"
                onClick={() => api.current?.recenter()}
              >
                <LocateIcon />
              </IconButton>
            )}
          </div>
        )}
        </div>

        {data && !empty && <Legend withContext={context !== undefined} />}
      </section>
      <div id="depois-do-mapa" className="flex h-9 items-center justify-between gap-2 border-t border-line pr-1 pl-3">
        <p className="min-w-0 truncate text-legenda text-subtle tabular-nums">{countText}</p>
        <Button variant="ghost" size="sm" className="h-7" onClick={onToggle} aria-expanded aria-keyshortcuts="M">
          Recolher
          <ChevronUpIcon />
          <span className="hidden md:contents">
            <Kbd>M</Kbd>
          </span>
        </Button>
      </div>
    </div>
  );
}
