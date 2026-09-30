"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import type { LeadSort } from "@/lib/api";
import { LEAD_SORT_FIELDS, SITE_STATUS_LABEL, type LeadDTO, type OutreachSettings } from "@/lib/contract";
import { cx } from "@/lib/cx";
import { formatDayMonth, formatNumber, formatRating } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-client-state";
import { PAGE_SIZES } from "@/lib/view-state";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, KeyboardIcon } from "../icons";
import { Monogram, SiteMark, Thermometer } from "../lead-ui";
import { ProposalButton } from "../outreach";
import { Button, IconButton, inputClass, Kbd, Skeleton } from "../ui";

export const SORT_LABEL: Record<LeadSort, string> = {
  score: "Oportunidade",
  name: "Nome",
  city: "Cidade",
  category: "Categoria",
  rating: "Nota",
  reviewCount: "Avaliações",
  updatedAt: "Atualização",
};

// ---------- Linha (64 px; 72 no celular) ----------

function lineTwo(lead: LeadDTO): string[] {
  const parts: string[] = [];
  const label = SITE_STATUS_LABEL[lead.siteStatus];
  if (lead.contactedAt) {
    parts.push(`Contatada em ${formatDayMonth(lead.contactedAt)}`);
  } else {
    const reason = lead.scoreReasons.find((r) => r !== label);
    if (reason) parts.push(reason);
  }
  if (lead.rating !== null) {
    parts.push(
      `${formatRating(lead.rating)}${lead.reviewCount !== null ? ` (${formatNumber(lead.reviewCount)})` : ""}`,
    );
  }
  return parts;
}

function Row({
  lead,
  index,
  selected,
  tabbable,
  showCity,
  settings,
  onOpen,
  onMove,
  onHover,
  onSend,
  onAddWhatsapp,
  compact,
}: {
  lead: LeadDTO;
  index: number;
  selected: boolean;
  tabbable: boolean;
  showCity: boolean;
  settings: OutreachSettings | undefined;
  onOpen: (lead: LeadDTO, focusMessage: boolean) => void;
  onMove: (delta: 1 | -1) => void;
  onHover: (id: string | null) => void;
  onSend: (lead: LeadDTO) => void;
  onAddWhatsapp: (lead: LeadDTO) => void;
  compact: boolean;
}) {
  const contacted = lead.contactedAt !== null;
  const place = [lead.neighborhood ?? (showCity ? null : lead.city), showCity ? lead.city : null]
    .filter(Boolean)
    .join(", ");
  const details = lineTwo(lead);

  return (
    <li
      data-row-id={lead.id}
      onMouseEnter={() => onHover(lead.id)}
      onMouseLeave={() => onHover(null)}
      className={cx(
        "anima-linha flex min-h-[72px] items-center gap-3 border-b border-line-soft pr-3 transicao last:border-b-0 sm:min-h-16",
        selected ? "bg-selected shadow-[inset_2px_0_0_var(--tinta-2)]" : "hover:bg-hover",
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
    >
      <button
        type="button"
        data-row-main=""
        tabIndex={tabbable ? 0 : -1}
        aria-current={selected ? "true" : undefined}
        onClick={(event: MouseEvent<HTMLButtonElement>) => onOpen(lead, event.detail === 0)}
        onFocus={() => onHover(lead.id)}
        onBlur={() => onHover(null)}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            onMove(event.key === "ArrowDown" ? 1 : -1);
          }
        }}
        className="grid min-w-0 flex-1 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 self-stretch rounded-control py-2 pl-3 text-left focus-visible:outline-offset-[-2px] sm:grid-cols-[40px_minmax(0,1fr)_128px]"
      >
        <Monogram name={lead.name} stars={lead.stars} contacted={contacted} />
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-2">
            <span
              className={cx(
                "truncate text-forte font-semibold underline-offset-2 hover:underline",
                contacted ? "text-muted" : "text-fg",
              )}
            >
              {lead.name}
            </span>
            {place && <span className="hidden shrink truncate text-legenda text-subtle sm:inline">{place}</span>}
          </span>
          {/* Celular: termômetro na segunda linha */}
          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-legenda text-subtle sm:hidden">
            <Thermometer stars={lead.stars} score={lead.score} className={cx(contacted && "opacity-60")} />
            <span aria-hidden="true">·</span>
            <span className="truncate">{SITE_STATUS_LABEL[lead.siteStatus]}</span>
          </span>
          <span className="mt-0.5 hidden min-w-0 items-center gap-1.5 text-legenda text-subtle sm:flex">
            <SiteMark status={lead.siteStatus} />
            <span className="shrink-0 text-muted">{SITE_STATUS_LABEL[lead.siteStatus]}</span>
            {details.map((part, i) => (
              <span key={part} className={cx("flex min-w-0 items-center gap-1.5", i === 0 && "shrink")}>
                <span aria-hidden="true">·</span>
                {contacted && i === 0 && <CheckIcon className="size-3.5 shrink-0" />}
                <span className="truncate">{part}</span>
              </span>
            ))}
          </span>
        </span>
        <span className="hidden sm:block">
          <Thermometer stars={lead.stars} score={lead.score} className={cx(contacted && "opacity-60")} />
        </span>
      </button>
      <div className="flex shrink-0 justify-end sm:w-[152px]">
        <ProposalButton
          lead={lead}
          settings={settings}
          onSend={onSend}
          onAddWhatsapp={onAddWhatsapp}
          tabIndex={tabbable ? 0 : -1}
          compact={compact}
        />
      </div>
    </li>
  );
}

export function ListSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Carregando empresas…</span>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} aria-hidden="true" className="flex h-16 items-center gap-3 border-b border-line-soft px-3">
          <Skeleton className="size-10 rounded-card" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="hidden h-1 w-[38px] sm:block" />
          <Skeleton className="h-8 w-11 rounded-control sm:w-36" />
        </div>
      ))}
    </div>
  );
}

export function LeadRows({
  items,
  selectedId,
  showCity,
  settings,
  busy,
  onOpen,
  onMove,
  onHover,
  onSend,
  onAddWhatsapp,
}: {
  items: LeadDTO[];
  selectedId: string | null;
  showCity: boolean;
  settings: OutreachSettings | undefined;
  busy: boolean;
  onOpen: (lead: LeadDTO, focusMessage: boolean) => void;
  onMove: (delta: 1 | -1) => void;
  onHover: (id: string | null) => void;
  onSend: (lead: LeadDTO) => void;
  onAddWhatsapp: (lead: LeadDTO) => void;
}) {
  // Um só ponto de Tab na lista: a linha selecionada, ou a primeira.
  const tabId = items.some((l) => l.id === selectedId) ? selectedId : (items[0]?.id ?? null);
  const compact = !useMediaQuery("(min-width: 640px)", true);
  return (
    <ul aria-label="Empresas" aria-busy={busy || undefined} className={cx("transicao", busy && "opacity-60")}>
      {items.map((lead, index) => (
        <Row
          key={lead.id}
          lead={lead}
          index={index}
          selected={lead.id === selectedId}
          tabbable={lead.id === tabId}
          showCity={showCity}
          settings={settings}
          onOpen={onOpen}
          onMove={onMove}
          onHover={onHover}
          onSend={onSend}
          onAddWhatsapp={onAddWhatsapp}
          compact={compact}
        />
      ))}
    </ul>
  );
}

// ---------- Barra da lista ----------

const SHORTCUTS: Array<[string, string]> = [
  ["J / K", "Próxima / anterior empresa"],
  ["Enter", "Abrir o painel na mensagem"],
  ["E", "Enviar a proposta"],
  ["C", "Copiar a mensagem"],
  ["N", "Ir para as observações"],
  ["M", "Abrir ou recolher o mapa"],
  ["/", "Buscar empresa"],
  ["Esc", "Fechar o que estiver aberto"],
];

export function ShortcutsButton({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, onOpenChange]);

  return (
    <div
      ref={wrapper}
      className="relative hidden md:block"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          onOpenChange(false);
          trigger.current?.focus();
        }
      }}
    >
      <Button
        ref={trigger}
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls="atalhos"
        aria-keyshortcuts="?"
        onClick={() => onOpenChange(!open)}
        icon={<KeyboardIcon />}
      >
        Atalhos <Kbd>?</Kbd>
      </Button>
      {open && (
        <div
          id="atalhos"
          role="group"
          aria-label="Atalhos de teclado"
          className="anima-menu absolute top-full right-0 z-30 mt-2 w-72 origin-top-right rounded-card bg-surface-3 p-3 shadow-elev-3"
        >
          <dl className="space-y-1.5">
            {SHORTCUTS.map(([keys, text]) => (
              <div key={keys} className="flex items-center justify-between gap-3">
                <dt className="text-muted">{text}</dt>
                <dd className="flex shrink-0 gap-1">
                  {keys.split(" / ").map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

export function ListBar({
  total,
  stageLabel,
  sort,
  dir,
  onSort,
  onDir,
  shortcutsOpen,
  onShortcutsOpen,
}: {
  total: number | undefined;
  stageLabel: string | null;
  sort: LeadSort;
  dir: "asc" | "desc";
  onSort: (field: LeadSort) => void;
  onDir: () => void;
  shortcutsOpen: boolean;
  onShortcutsOpen: (open: boolean) => void;
}) {
  return (
    <div className="flex h-11 items-center justify-between gap-2 border-b border-line px-3">
      <p className="min-w-0 truncate">
        <span className="font-display text-numero font-semibold tabular-nums">
          {total === undefined ? "—" : formatNumber(total)}
        </span>{" "}
        <span className="text-muted">{total === 1 ? "empresa" : "empresas"}</span>
        {stageLabel && <span className="hidden text-subtle sm:inline"> · {stageLabel}</span>}
      </p>
      <div className="flex items-center gap-1.5">
        <label htmlFor="ordenar" className="hidden text-legenda text-subtle sm:block">
          Ordenar
        </label>
        <select
          id="ordenar"
          value={sort}
          onChange={(event) => {
            const field = LEAD_SORT_FIELDS.find((f) => f === event.target.value);
            if (field) onSort(field);
          }}
          className={cx(inputClass, "h-8 w-auto text-botao")}
          aria-label="Ordenar por"
        >
          {LEAD_SORT_FIELDS.map((field) => (
            <option key={field} value={field}>
              {SORT_LABEL[field]}
            </option>
          ))}
        </select>
        <IconButton
          label={dir === "desc" ? "Ordem decrescente" : "Ordem crescente"}
          variant="secondary"
          onClick={onDir}
        >
          {dir === "desc" ? <ArrowDownIcon /> : <ArrowUpIcon />}
        </IconButton>
        <ShortcutsButton open={shortcutsOpen} onOpenChange={onShortcutsOpen} />
      </div>
    </div>
  );
}

// ---------- Paginação ----------

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      aria-label="Paginação"
      className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-1.5 text-botao text-muted tabular-nums"
    >
      <p>
        {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <label className="hidden items-center gap-1.5 whitespace-nowrap sm:flex">
          Por página
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            className={cx(inputClass, "h-8 w-auto text-botao")}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <IconButton
          label="Página anterior"
          variant="secondary"
          className="max-sm:size-11"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeftIcon />
        </IconButton>
        <span>
          Página {formatNumber(page)} de {formatNumber(pages)}
        </span>
        <IconButton
          label="Próxima página"
          variant="secondary"
          className="max-sm:size-11"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
        >
          <ChevronRightIcon />
        </IconButton>
      </div>
    </nav>
  );
}
