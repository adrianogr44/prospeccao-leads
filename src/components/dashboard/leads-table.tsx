"use client";

import type { LeadDTO, OutreachSettings } from "@/lib/contract";
import type { LeadSort } from "@/lib/api";
import { PAGE_SIZES } from "@/lib/view-state";
import { formatNumber, formatRating, hostOf } from "@/lib/format";
import { cx } from "@/lib/cx";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, SortIcon } from "../icons";
import { ContactIcons, SiteBadge, Stars } from "../lead-ui";
import { ProposalButton } from "../outreach";
import { Badge, Button, Skeleton } from "../ui";

interface Column {
  label: string;
  sort?: LeadSort;
  className?: string;
}

// A coluna de proposta fica presa à direita (do tablet para cima) para o botão nunca sair da tela.
// Sombra no lugar de borda: borda em célula fixa some com border-collapse.
const STICKY_RIGHT = "md:sticky md:right-0 md:shadow-[-1px_0_0_var(--line)]";

const columns: Column[] = [
  { label: "Oportunidade", sort: "score", className: "w-56" },
  { label: "Empresa", sort: "name", className: "w-64" },
  { label: "Local", sort: "city", className: "w-48" },
  { label: "Site", className: "w-40" },
  { label: "Nota", sort: "rating", className: "w-28" },
  { label: "Contato", className: "w-28" },
  { label: "Proposta", className: cx("w-44", STICKY_RIGHT, "md:z-20") },
];

function SortableHeader({
  column,
  sort,
  dir,
  onSort,
}: {
  column: Column;
  sort: LeadSort;
  dir: "asc" | "desc";
  onSort: (field: LeadSort) => void;
}) {
  const field = column.sort;
  const base = "sticky top-0 z-10 border-b border-line bg-surface px-3 py-2 text-left text-xs font-medium text-muted";
  if (!field) {
    return (
      <th scope="col" className={cx(base, column.className)}>
        {column.label}
      </th>
    );
  }
  const active = sort === field;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cx(base, column.className)}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cx(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-fg",
          active && "text-fg",
        )}
      >
        {column.label}
        {active ? (
          dir === "asc" ? (
            <ChevronUpIcon className="size-3.5" />
          ) : (
            <ChevronDownIcon className="size-3.5" />
          )
        ) : (
          <SortIcon className="size-3.5 opacity-50" />
        )}
      </button>
    </th>
  );
}

function Row({
  lead,
  settings,
  onSelect,
  onUpdated,
}: {
  lead: LeadDTO;
  settings: OutreachSettings | undefined;
  onSelect: (lead: LeadDTO) => void;
  onUpdated: (lead: LeadDTO) => void;
}) {
  const place = [lead.neighborhood, [lead.city, lead.state].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(", ");
  return (
    <tr
      onClick={() => onSelect(lead)}
      className="group cursor-pointer border-b border-line align-top last:border-b-0 hover:bg-surface"
    >
      <td className="px-3 py-2.5">
        <Stars value={lead.stars} />
        {lead.scoreReasons[0] && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{lead.scoreReasons[0]}</p>
        )}
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(lead);
          }}
          aria-haspopup="dialog"
          className="rounded text-left font-medium hover:text-accent"
        >
          {lead.name}
        </button>
        {lead.category && <p className="text-xs text-muted">{lead.category}</p>}
      </td>
      <td className="px-3 py-2.5 text-muted">{place || "—"}</td>
      <td className="px-3 py-2.5">
        <SiteBadge status={lead.siteStatus} />
        {lead.sitePlatform ? (
          <p className="mt-0.5 text-xs text-muted">{lead.sitePlatform}</p>
        ) : lead.website ? (
          <p className="mt-0.5 max-w-36 truncate text-xs text-muted">{hostOf(lead.website)}</p>
        ) : null}
      </td>
      <td className="px-3 py-2.5 tabular-nums">
        {lead.rating !== null ? (
          <>
            <span className="font-medium">{formatRating(lead.rating)}</span>
            {lead.reviewCount !== null && (
              <span className="text-xs text-muted"> ({formatNumber(lead.reviewCount)})</span>
            )}
          </>
        ) : (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Sem avaliações</span>
          </>
        )}
      </td>
      <td className="px-3 py-2">
        <ContactIcons lead={lead} />
      </td>
      <td className={cx("bg-canvas px-3 py-2 group-hover:bg-surface", STICKY_RIGHT)}>
        <ProposalButton lead={lead} settings={settings} onUpdated={onUpdated} onOpen={onSelect} />
        {lead.contactedAt && (
          <p className="mt-0.5">
            <Badge tone="accent">Contatado</Badge>
          </p>
        )}
      </td>
    </tr>
  );
}

export function TableSkeleton() {
  return (
    <div className="space-y-2 p-3" aria-busy="true" aria-label="Carregando empresas" role="status">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function LeadsTable({
  items,
  sort,
  dir,
  onSort,
  settings,
  onSelect,
  onUpdated,
  busy,
}: {
  items: LeadDTO[];
  sort: LeadSort;
  dir: "asc" | "desc";
  onSort: (field: LeadSort) => void;
  settings: OutreachSettings | undefined;
  onSelect: (lead: LeadDTO) => void;
  onUpdated: (lead: LeadDTO) => void;
  busy: boolean;
}) {
  return (
    <div
      className={cx(
        "max-h-[70vh] overflow-auto rounded-lg border border-line transition-opacity",
        busy && "opacity-60",
      )}
    >
      <table className="w-full min-w-[68rem] border-collapse text-sm">
        <caption className="sr-only">Empresas encontradas</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <SortableHeader key={column.label} column={column} sort={sort} dir={dir} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((lead) => (
            <Row key={lead.id} lead={lead} settings={settings} onSelect={onSelect} onUpdated={onUpdated} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
    <nav aria-label="Paginação" className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted tabular-nums" aria-live="polite">
        {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-muted">
          Por página
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            className="h-8 rounded-md border border-line bg-canvas px-1.5 text-fg"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          <ChevronLeftIcon />
          Anterior
        </Button>
        <span className="text-muted tabular-nums">
          Página {formatNumber(page)} de {formatNumber(pages)}
        </span>
        <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
          Próxima
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  );
}
