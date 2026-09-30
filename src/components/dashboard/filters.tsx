"use client";

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import {
  SITE_STATUSES,
  SITE_STATUS_LABEL,
  type LeadFilters,
  type MetaResponse,
  type SearchDTO,
} from "@/lib/contract";
import { cx } from "@/lib/cx";
import { formatDateTime, formatNumber, formatRating } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-client-state";
import { activeStage, STAGE_KEYS } from "@/lib/view-state";
import { FilterIcon, SearchIcon } from "../icons";
import { THERMO_LABEL } from "../lead-ui";
import { Sheet } from "../modal";
import { Button, Chip, Field, inputClass, Kbd, labelClass } from "../ui";

const DEBOUNCE_MS = 250;

/** Campo de texto/número que confirma o valor 250 ms depois de parar de digitar. */
export function DebouncedInput({
  value,
  onCommit,
  className,
  ...props
}: {
  value: string;
  onCommit: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [committed, setCommitted] = useState(value);

  // Mudança vinda de fora (ex.: chip removido, "Limpar tudo"): adota o valor novo.
  if (value !== seen) {
    setSeen(value);
    if (value !== committed) {
      setDraft(value);
      setCommitted(value);
    }
  }

  useEffect(() => {
    if (draft === committed) return;
    const timer = setTimeout(() => {
      setCommitted(draft);
      onCommit(draft);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, committed, onCommit]);

  return (
    <input
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      className={cx(inputClass, className)}
    />
  );
}

/** Busca livre (`q`). A tecla / foca o campo visível. */
export function SearchBox({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="search" className={cx("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Buscar empresa
      </label>
      <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-subtle" />
      <DebouncedInput
        id={id}
        type="search"
        data-search=""
        aria-keyshortcuts="/"
        value={value}
        onCommit={onCommit}
        placeholder="Buscar empresa…"
        autoComplete="off"
        className="pr-9 pl-9"
      />
      <span className="pointer-events-none absolute top-2 right-2 hidden sm:block">
        <Kbd>/</Kbd>
      </span>
    </div>
  );
}

// ---------- Rótulos dos filtros ----------

const yesNo = (v: "yes" | "no") => (v === "yes" ? "Sim" : "Não");

const CHIP_LABEL: Record<keyof LeadFilters, string> = {
  q: "Busca",
  city: "Cidade",
  state: "Estado",
  category: "Categoria",
  searchId: "Pesquisa",
  siteStatus: "Site",
  hasSite: "Tem site",
  hasWhatsapp: "Tem WhatsApp",
  hasInstagram: "Tem Instagram",
  contacted: "Contatada",
  needsSite: "Precisa de site",
  hasContact: "Tem contato",
  minRating: "Nota mínima",
  maxRating: "Nota máxima",
  minReviews: "Avaliações mín.",
  maxReviews: "Avaliações máx.",
  minStars: "Oportunidade",
};

export const minStarsLabel = (n: number) => (n <= 1 ? "Qualquer" : `A partir de ${THERMO_LABEL[n]}`);

const searchLabel = (s: SearchDTO) => `${s.category} · ${s.city} (${formatDateTime(s.createdAt)})`;

function chipValue(key: keyof LeadFilters, filters: LeadFilters, searches: SearchDTO[] | undefined): string {
  const value = filters[key];
  if (value === undefined) return "";
  switch (key) {
    case "hasSite":
    case "hasWhatsapp":
    case "hasInstagram":
    case "contacted":
    case "needsSite":
    case "hasContact":
      return yesNo(value as "yes" | "no");
    case "siteStatus":
      return SITE_STATUS_LABEL[filters.siteStatus ?? "UNKNOWN"];
    case "minStars":
      return minStarsLabel(Number(value)).replace("A partir de", "a partir de");
    case "minRating":
    case "maxRating":
      return formatRating(Number(value));
    case "minReviews":
    case "maxReviews":
      return formatNumber(Number(value));
    case "searchId": {
      const search = searches?.find((s) => s.id === value);
      return search ? searchLabel(search) : "selecionada";
    }
    default:
      return String(value);
  }
}

/** Filtros que viram chip: tudo, menos a etapa reconhecida pelo funil. */
function chipKeys(filters: LeadFilters): Array<keyof LeadFilters> {
  const stage = activeStage(filters);
  return (Object.keys(filters) as Array<keyof LeadFilters>).filter(
    (key) => filters[key] !== undefined && !(stage !== null && (STAGE_KEYS as readonly string[]).includes(key)),
  );
}

const ADVANCED_KEYS = [
  "state",
  "hasSite",
  "hasWhatsapp",
  "hasInstagram",
  "contacted",
  "minStars",
  "minRating",
  "minReviews",
  "maxReviews",
  "searchId",
] as const satisfies ReadonlyArray<keyof LeadFilters>;

// ---------- Campos ----------

const toOptions = (values: string[] | undefined) => (values ?? []).map((v) => ({ value: v, label: v }));

function NativeSelect({
  id,
  label,
  value,
  options,
  allLabel,
  onChange,
  srOnlyLabel = false,
  className,
}: {
  id: string;
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
  onChange: (value: string | undefined) => void;
  srOnlyLabel?: boolean;
  className?: string;
}) {
  // mantém visível um valor vindo da URL que não está na lista
  const list = value && !options.some((o) => o.value === value) ? [{ value, label: value }, ...options] : options;
  return (
    <div className={className}>
      <label htmlFor={id} className={srOnlyLabel ? "sr-only" : labelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        className={cx(inputClass, "truncate", value && "font-medium")}
      >
        <option value="">{allLabel}</option>
        {list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const yesNoOptions = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
];
const asYesNo = (v: string | undefined) => (v === "yes" || v === "no" ? v : undefined);

function numberOrUndefined(raw: string, min: number, max: number, integer: boolean): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  const clamped = Math.min(max, Math.max(min, n));
  return integer ? Math.round(clamped) : clamped;
}

/** Oportunidade mínima como os 5 segmentos do termômetro. */
function MinStarsPicker({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const current = value ?? 1;
  return (
    <fieldset>
      <legend className={labelClass}>Oportunidade mínima</legend>
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={current === n}
              aria-label={minStarsLabel(n)}
              title={minStarsLabel(n)}
              onClick={() => onChange(n <= 1 || value === n ? undefined : n)}
              className="alvo group flex h-9 w-7 items-center justify-center rounded-control transicao hover:bg-hover"
            >
              <span
                className={cx(
                  "h-2 w-5 rounded-[2px]",
                  n >= current && current > 1 ? "bg-[var(--termo-4)]" : "bg-[var(--termo-vazio)]",
                  current === n && "shadow-[0_0_0_1.5px_var(--tinta-1)]",
                )}
              />
            </button>
          ))}
        </div>
        <span className="text-legenda text-muted">{minStarsLabel(current)}</span>
      </div>
    </fieldset>
  );
}

function AdvancedFields({
  filters,
  meta,
  searches,
  onChange,
  includeMain,
}: {
  filters: LeadFilters;
  meta: MetaResponse | undefined;
  searches: SearchDTO[] | undefined;
  onChange: (patch: Partial<LeadFilters>) => void;
  /** No celular a folha também traz Cidade, Categoria e Situação do site. */
  includeMain: boolean;
}) {
  const p = useId();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {includeMain && (
        <>
          <NativeSelect
            id={`${p}-city`}
            label="Cidade"
            value={filters.city}
            options={toOptions(meta?.cities)}
            allLabel="Todas"
            onChange={(city) => onChange({ city })}
          />
          <NativeSelect
            id={`${p}-category`}
            label="Categoria"
            value={filters.category}
            options={toOptions(meta?.categories)}
            allLabel="Todas"
            onChange={(category) => onChange({ category })}
          />
          <NativeSelect
            id={`${p}-site`}
            label="Situação do site"
            value={filters.siteStatus}
            options={SITE_STATUSES.map((s) => ({ value: s, label: SITE_STATUS_LABEL[s] }))}
            allLabel="Todas"
            onChange={(v) => onChange({ siteStatus: SITE_STATUSES.find((s) => s === v) })}
          />
        </>
      )}
      <NativeSelect
        id={`${p}-state`}
        label="Estado"
        value={filters.state}
        options={toOptions(meta?.states)}
        allLabel="Todos"
        onChange={(state) => onChange({ state })}
      />
      <NativeSelect
        id={`${p}-hassite`}
        label="Tem site"
        value={filters.hasSite}
        options={yesNoOptions}
        allLabel="Tanto faz"
        onChange={(v) => onChange({ hasSite: asYesNo(v) })}
      />
      <NativeSelect
        id={`${p}-whatsapp`}
        label="Tem WhatsApp"
        value={filters.hasWhatsapp}
        options={yesNoOptions}
        allLabel="Tanto faz"
        onChange={(v) => onChange({ hasWhatsapp: asYesNo(v) })}
      />
      <NativeSelect
        id={`${p}-instagram`}
        label="Tem Instagram"
        value={filters.hasInstagram}
        options={yesNoOptions}
        allLabel="Tanto faz"
        onChange={(v) => onChange({ hasInstagram: asYesNo(v) })}
      />
      <NativeSelect
        id={`${p}-contacted`}
        label="Contatada"
        value={filters.contacted}
        options={yesNoOptions}
        allLabel="Tanto faz"
        onChange={(v) => onChange({ contacted: asYesNo(v) })}
      />
      <MinStarsPicker value={filters.minStars} onChange={(minStars) => onChange({ minStars })} />
      <Field id={`${p}-rating`} label="Nota mínima (0 a 5)">
        {(control) => (
          <DebouncedInput
            {...control}
            type="number"
            inputMode="decimal"
            min={0}
            max={5}
            step={0.1}
            value={filters.minRating?.toString() ?? ""}
            onCommit={(v) => onChange({ minRating: numberOrUndefined(v, 0, 5, false) })}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${p}-min-reviews`} label="Avaliações mín.">
          {(control) => (
            <DebouncedInput
              {...control}
              type="number"
              inputMode="numeric"
              min={0}
              value={filters.minReviews?.toString() ?? ""}
              onCommit={(v) => onChange({ minReviews: numberOrUndefined(v, 0, 1_000_000, true) })}
            />
          )}
        </Field>
        <Field id={`${p}-max-reviews`} label="Avaliações máx.">
          {(control) => (
            <DebouncedInput
              {...control}
              type="number"
              inputMode="numeric"
              min={0}
              value={filters.maxReviews?.toString() ?? ""}
              onCommit={(v) => onChange({ maxReviews: numberOrUndefined(v, 0, 1_000_000, true) })}
            />
          )}
        </Field>
      </div>
      <NativeSelect
        id={`${p}-search`}
        label="Pesquisa de origem"
        value={filters.searchId}
        allLabel="Todas"
        options={(searches ?? []).map((s) => ({ value: s.id, label: searchLabel(s) }))}
        onChange={(searchId) => onChange({ searchId })}
        className="sm:col-span-2"
      />
    </div>
  );
}

/** Foca o primeiro campo quando o painel monta. Identidade estável: roda só na montagem. */
function focusFirstField(node: HTMLElement | null) {
  node?.querySelector<HTMLElement>("select, input, button")?.focus();
}

function Popover({ onClose, children }: { onClose: (restoreFocus: boolean) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => focusFirstField(ref.current), []);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const trigger = ref.current?.parentElement;
      if (trigger && !trigger.contains(event.target as Node)) onClose(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Mais filtros"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose(true);
        }
      }}
      className="anima-menu absolute top-full right-0 z-30 mt-2 w-[480px] origin-top-right rounded-card bg-surface-3 p-4 shadow-elev-3"
    >
      {children}
    </div>
  );
}

// ---------- Barra ----------

export function FiltersBar({
  filters,
  meta,
  searches,
  total,
  onChange,
  onClearAll,
}: {
  filters: LeadFilters;
  meta: MetaResponse | undefined;
  searches: SearchDTO[] | undefined;
  /** Total da lista atual (rodapé da folha do celular). */
  total: number | undefined;
  onChange: (patch: Partial<LeadFilters>) => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const wide = useMediaQuery("(min-width: 640px)", true);

  const cities = meta?.cities ?? [];
  const categories = meta?.categories ?? [];
  const showCity = cities.length >= 2 || filters.city !== undefined;
  const showCategory = categories.length >= 2 || filters.category !== undefined;
  // Filtro de etapa reconhecida fica no funil: não conta como avançado.
  const stage = activeStage(filters);
  const advancedActive = ADVANCED_KEYS.filter(
    (key) => filters[key] !== undefined && !(stage !== null && key === "contacted"),
  ).length;
  const mobileActive =
    advancedActive + (["city", "category", "siteStatus"] as const).filter((k) => filters[k] !== undefined).length;
  const chips = chipKeys(filters);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <SearchBox
          value={filters.q ?? ""}
          onCommit={(v) => onChange({ q: v.trim() || undefined })}
          className="min-w-0 flex-1 sm:hidden"
        />
        <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex">
          {showCity && (
            <NativeSelect
              id="f-city"
              label="Cidade"
              srOnlyLabel
              value={filters.city}
              options={toOptions(cities)}
              allLabel="Todas as cidades"
              onChange={(city) => onChange({ city })}
              className="w-44"
            />
          )}
          {showCategory && (
            <NativeSelect
              id="f-category"
              label="Categoria"
              srOnlyLabel
              value={filters.category}
              options={toOptions(categories)}
              allLabel="Todas as categorias"
              onChange={(category) => onChange({ category })}
              className="w-48"
            />
          )}
          <NativeSelect
            id="f-site"
            label="Situação do site"
            srOnlyLabel
            value={filters.siteStatus}
            options={SITE_STATUSES.map((s) => ({ value: s, label: SITE_STATUS_LABEL[s] }))}
            allLabel="Qualquer situação do site"
            onChange={(v) => onChange({ siteStatus: SITE_STATUSES.find((s) => s === v) })}
            className="w-56"
          />
        </div>
        <div className="relative">
          <Button
            ref={trigger}
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((v) => !v)}
            icon={<FilterIcon />}
          >
            <span className="hidden sm:inline">Mais filtros</span>
            <span className="sm:hidden">Filtros</span>
            {(wide ? advancedActive : mobileActive) > 0 && (
              <span className="font-display tabular-nums text-muted">({wide ? advancedActive : mobileActive})</span>
            )}
          </Button>
          {open && wide && (
            <Popover onClose={close}>
              <AdvancedFields filters={filters} meta={meta} searches={searches} onChange={onChange} includeMain={false} />
            </Popover>
          )}
        </div>
      </div>

      {open && !wide && (
        <Sheet label="Filtros" side="bottom" onClose={() => close(true)}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-display text-h2 font-semibold">Filtros</h2>
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <AdvancedFields filters={filters} meta={meta} searches={searches} onChange={onChange} includeMain />
          </div>
          <div className="flex gap-2 border-t border-line px-5 py-3">
            <Button
              variant="primary"
              className="h-11 flex-1"
              onClick={(event) => event.currentTarget.closest("dialog")?.close()}
            >
              Ver {total === undefined ? "" : formatNumber(total)} empresas
            </Button>
            <Button className="h-11" onClick={onClearAll}>
              Limpar
            </Button>
          </div>
        </Sheet>
      )}

      {chips.length > 0 && (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <ul aria-label="Filtros ativos" className="flex items-center gap-2 sm:flex-wrap">
            {chips.map((key) => (
              <li key={key} className="shrink-0">
                <Chip
                  label={CHIP_LABEL[key]}
                  value={chipValue(key, filters, searches)}
                  onRemove={() => onChange({ [key]: undefined })}
                />
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={onClearAll}>
            Limpar tudo
          </Button>
        </div>
      )}
    </div>
  );
}
