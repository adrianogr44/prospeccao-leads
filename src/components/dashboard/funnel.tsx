"use client";

import type { FunnelStats } from "@/lib/contract";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/format";
import { FUNNEL_STAGES, type FunnelStage } from "@/lib/view-state";
import { CornerDownIcon } from "../icons";
import { Button, ErrorState, panelClass } from "../ui";

// Funil deitado (docs/design/visual-radar.md 4.5): barras centradas num eixo comum, afinando para a direita,
// ligadas por conectores trapezoidais. "Prontas para abordar" é o herói.

const BAR_MIN = 16;
const BAR_RANGE = 56;
const SKELETON_HEIGHTS: Record<FunnelStage, number> = { found: 72, needsSite: 64, reachable: 44, ready: 28, contacted: 20 };

function barHeight(value: number, found: number): number {
  if (found <= 0) return BAR_MIN;
  return BAR_MIN + BAR_RANGE * Math.min(1, value / found);
}

/** Taxa sem inteiros quebrados: "< 1%" para 0 < x < 0,5; "-" quando a anterior é zero. */
export function funnelRate(stage: FunnelStage, funnel: FunnelStats): string {
  const pct = (part: number, whole: number) => {
    if (whole <= 0) return "-";
    const value = (part / whole) * 100;
    if (value > 0 && value < 0.5) return "< 1%";
    return `${Math.round(value)}%`;
  };
  switch (stage) {
    case "found":
      return "total";
    case "needsSite":
    case "reachable":
    case "ready": {
      const previous = { needsSite: funnel.found, reachable: funnel.needsSite, ready: funnel.reachable }[stage];
      const rate = pct(funnel[stage], previous);
      return rate === "-" ? "-" : `${rate} da anterior`;
    }
    case "contacted": {
      const rate = pct(funnel.contacted, funnel.contacted + funnel.ready);
      return rate === "-" ? "-" : `${rate} já abordadas`;
    }
  }
}

/** Conector: polígono de 20 px cujos lados acompanham as alturas das barras vizinhas. */
function Connector({ left, right }: { left: number; right: number }) {
  const top = (h: number) => 36 - h / 2;
  return (
    <svg viewBox="0 0 20 72" preserveAspectRatio="none" aria-hidden="true" className="h-[72px] w-5 fill-hover">
      <polygon points={`0,${top(left)} 20,${top(right)} 20,${72 - top(right)} 0,${72 - top(left)}`} />
    </svg>
  );
}

const barTone = (stage: FunnelStage) =>
  stage === "ready"
    ? "bg-amber-soft shadow-[inset_0_0_0_1px_var(--anel-funil-heroi),var(--brilho-funil-heroi)] group-hover:shadow-[inset_0_0_0_1px_var(--anel-funil-heroi),0_0_28px_-2px_var(--letreiro-halo)]"
    : stage === "contacted"
      ? "bg-sent-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--envio)_40%,transparent)] group-hover:shadow-[inset_0_0_0_1px_var(--fio-forte)]"
      : "bg-selected shadow-[inset_0_0_0_1px_var(--fio)] group-hover:shadow-[inset_0_0_0_1px_var(--fio-forte)]";

const selectedRing = (stage: FunnelStage) =>
  stage === "ready"
    ? "shadow-[inset_0_0_0_1.5px_var(--letreiro-brilho),var(--brilho-funil-heroi)]"
    : "shadow-[inset_0_0_0_1.5px_var(--tinta-1)]";

export function Funnel({
  funnel,
  active,
  loading,
  error,
  onRetry,
  onStage,
  onLeak,
  leakActive,
}: {
  funnel: FunnelStats | undefined;
  active: FunnelStage | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Clicar na etapa ativa a desfaz (o pai decide). */
  onStage: (stage: FunnelStage) => void;
  onLeak: () => void;
  leakActive: boolean;
}) {
  const leak = funnel ? funnel.needsSite - funnel.reachable : 0;
  const hasSelection = active !== null && active !== "found";
  const dim = active !== null;

  const stageButton = (stage: (typeof FUNNEL_STAGES)[number]) => {
    const value = funnel?.[stage.id];
    const hero = stage.id === "ready";
    const pressed = active === stage.id;
    const empty = value === 0;
    const idle = empty && !pressed;
    const h = value === undefined ? SKELETON_HEIGHTS[stage.id] : barHeight(value, funnel?.found ?? 0);
    return (
      <button
        key={stage.id}
        type="button"
        aria-pressed={pressed}
        aria-disabled={empty && !pressed ? true : undefined}
        onClick={() => {
          if (empty && !pressed) return;
          onStage(stage.id);
        }}
        className={cx(
          "group grid min-w-0 grid-rows-[16px_64px_72px_16px] gap-y-1.5 rounded-card text-left transicao focus-visible:outline-offset-4",
          idle && "cursor-default",
        )}
      >
        <span className={cx("rotulo truncate", hero && "text-muted")}>{stage.label}</span>
        <span
          className={cx(
            "self-end font-display font-semibold tabular-nums",
            hero
              ? cx("text-heroi font-bold tracking-heroi", idle ? "text-subtle" : "text-hero [text-shadow:var(--glow-heroi)]")
              : cx("text-kpi tracking-titulo", idle ? "text-subtle" : "text-fg"),
          )}
        >
          {value === undefined ? "—" : formatNumber(value)}
        </span>
        <span className="flex items-center">
          {value === undefined ? (
            <span className="esqueleto w-full rounded-control" style={{ height: h }} />
          ) : empty ? (
            <span className="h-0 w-full border-t-2 border-dashed border-line-strong" />
          ) : (
            <span
              className={cx(
                "w-full origin-center rounded-control transicao",
                barTone(stage.id),
                pressed && selectedRing(stage.id),
                // Só a barra apaga: rótulo, número e taxa ficam com o contraste cheio (texto pequeno não pode virar 2,4:1).
                dim && !pressed && "opacity-55 group-hover:opacity-100",
              )}
              style={{ height: h }}
            />
          )}
        </span>
        <span className={cx("truncate text-legenda tabular-nums", hero ? "text-muted" : "text-subtle")}>
          {funnel ? funnelRate(stage.id, funnel) : " "}
        </span>
      </button>
    );
  };

  const heights = FUNNEL_STAGES.map((s) =>
    funnel ? (funnel[s.id] === 0 ? 2 : barHeight(funnel[s.id], funnel.found)) : SKELETON_HEIGHTS[s.id],
  );

  const ready = funnel?.ready;

  return (
    <section aria-labelledby="funil-titulo" aria-busy={loading || undefined} className={cx(panelClass, "px-5 py-4")}>
      <h2 id="funil-titulo" className="sr-only">
        Funil de prospecção
      </h2>

      {error && !funnel ? (
        <ErrorState message="Não consegui carregar os números." detail={error} onRetry={onRetry} />
      ) : (
        <>
          {/* Desktop e tablet: funil deitado */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[1fr_20px_1fr_20px_1fr_20px_1.7fr_20px_1fr] items-start">
              {FUNNEL_STAGES.map((stage, i) => (
                <div key={stage.id} className="contents">
                  {stageButton(stage)}
                  {i < FUNNEL_STAGES.length - 1 && (
                    <div className="mt-[92px]">
                      {/* Contatadas é ramo de Precisam de site: sem conector de Prontas para Contatadas */}
                      {stage.id !== "ready" ? (
                        <Connector left={heights[i]} right={heights[i + 1]} />
                      ) : (
                        <span className="block h-[72px] w-5" />
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div className="col-span-9 grid h-7 grid-cols-subgrid items-end">
                {leak > 0 && (
                  <div className="col-start-3 col-end-6 flex justify-center">
                    <LeakLink count={leak} pressed={leakActive} onClick={onLeak} />
                  </div>
                )}
                {hasSelection && (
                  <div className="col-start-7 col-end-10 flex justify-end">
                    <Button variant="ghost" size="sm" className="-mr-2 h-7" onClick={() => onStage("found")}>
                      Limpar etapa
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Celular: número-herói + etapas em fila horizontal */}
          <div className="md:hidden">
            <button
              type="button"
              aria-pressed={active === "ready"}
              onClick={() => onStage("ready")}
              className="flex w-full flex-col items-start rounded-card text-left"
            >
              <span className="font-display text-heroi font-bold tracking-heroi text-hero tabular-nums [text-shadow:var(--glow-heroi)]">
                {ready === undefined ? "—" : formatNumber(ready)}
              </span>
              <span className="text-muted">prontas para abordar</span>
              <span className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-selected">
                <span
                  className="block h-full rounded-full bg-amber"
                  style={{ width: funnel && funnel.found > 0 ? `${(funnel.ready / funnel.found) * 100}%` : 0 }}
                />
              </span>
            </button>
            <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {FUNNEL_STAGES.filter((s) => s.id !== "ready").map((stage) => {
                const value = funnel?.[stage.id];
                const pressed = active === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => onStage(stage.id)}
                    className={cx(
                      "flex min-h-11 w-[120px] shrink-0 flex-col justify-center rounded-card px-3 py-1.5 text-left transicao",
                      pressed
                        ? "bg-selected shadow-[inset_0_0_0_1.5px_var(--tinta-1)]"
                        : "bg-hover shadow-[inset_0_0_0_1px_var(--fio)]",
                    )}
                  >
                    <span className="truncate text-legenda text-subtle">{stage.label}</span>
                    <span className="font-display text-numero font-semibold tabular-nums">
                      {value === undefined ? "—" : formatNumber(value)}
                    </span>
                  </button>
                );
              })}
            </div>
            {leak > 0 && (
              <div className="mt-2">
                <LeakLink count={leak} pressed={leakActive} onClick={onLeak} />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Vazamento entre "Precisam de site" e "Com contato": a fila para achar o WhatsApp à mão. */
function LeakLink({ count, pressed, onClick }: { count: number; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "alvo inline-flex h-6 items-center gap-1 rounded-control px-1.5 text-legenda underline-offset-2 transicao hover:text-fg hover:underline max-md:h-11 max-md:px-2",
        pressed ? "bg-selected font-medium text-fg" : "text-muted",
      )}
    >
      <CornerDownIcon className="size-3.5" />
      {formatNumber(count)} sem contato
    </button>
  );
}
