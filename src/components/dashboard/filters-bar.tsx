"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";
import { SITE_STATUSES, SITE_STATUS_LABEL, type LeadFilters, type MetaResponse, type SearchDTO } from "@/lib/contract";
import { cx } from "@/lib/cx";
import { formatDateTime } from "@/lib/format";
import { ChevronDownIcon, ChevronUpIcon, SearchIcon } from "../icons";
import { Button, Field, inputClass } from "../ui";

const DEBOUNCE_MS = 250;

/** Campo de texto/número que confirma o valor 250 ms depois de parar de digitar. */
function DebouncedInput({
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

  // Mudança vinda de fora (ex.: "Limpar", card): adota o valor novo.
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

function SelectFilter({
  id,
  label,
  value,
  options,
  allLabel = "Todos",
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
  onChange: (value: string | undefined) => void;
}) {
  // mantém visível um valor vindo da URL que não está na lista
  const list =
    value && !options.some((o) => o.value === value) ? [{ value, label: value }, ...options] : options;
  return (
    <Field id={id} label={label}>
      {(control) => (
        <select
          {...control}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value || undefined)}
          className={inputClass}
        >
          <option value="">{allLabel}</option>
          {list.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

const toOptions = (values: string[] | undefined) => (values ?? []).map((v) => ({ value: v, label: v }));

const yesNo = [
  { value: "yes", label: "Sim" },
  { value: "no", label: "Não" },
];

function numberOrUndefined(raw: string, min: number, max: number, integer: boolean): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  const clamped = Math.min(max, Math.max(min, n));
  return integer ? Math.round(clamped) : clamped;
}

const ADVANCED_KEYS = [
  "hasWhatsapp",
  "hasInstagram",
  "contacted",
  "minRating",
  "minReviews",
  "maxReviews",
  "minStars",
  "searchId",
] as const;

export function FiltersBar({
  filters,
  meta,
  searches,
  onChange,
  onClear,
}: {
  filters: LeadFilters;
  meta: MetaResponse | undefined;
  searches: SearchDTO[] | undefined;
  onChange: (patch: Partial<LeadFilters>) => void;
  onClear: () => void;
}) {
  const advancedActive = ADVANCED_KEYS.filter((key) => filters[key] !== undefined).length;
  const [expanded, setExpanded] = useState(false);
  const showAdvanced = expanded || advancedActive > 0;
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <form
      role="search"
      aria-label="Filtros"
      onSubmit={(event) => event.preventDefault()}
      className="space-y-3 rounded-lg border border-line bg-surface p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="f-q" label="Buscar" className="sm:col-span-2">
          {(control) => (
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted" />
              <DebouncedInput
                {...control}
                type="search"
                value={filters.q ?? ""}
                onCommit={(v) => onChange({ q: v.trim() || undefined })}
                placeholder="Nome, endereço, bairro ou telefone"
                autoComplete="off"
                className="pl-8"
              />
            </div>
          )}
        </Field>
        <SelectFilter
          id="f-city"
          label="Cidade"
          value={filters.city}
          options={toOptions(meta?.cities)}
          onChange={(city) => onChange({ city })}
        />
        <SelectFilter
          id="f-state"
          label="Estado"
          value={filters.state}
          options={toOptions(meta?.states)}
          onChange={(state) => onChange({ state })}
        />
        <SelectFilter
          id="f-category"
          label="Categoria"
          value={filters.category}
          options={toOptions(meta?.categories)}
          onChange={(category) => onChange({ category })}
        />
        <SelectFilter
          id="f-site"
          label="Situação do site"
          value={filters.siteStatus}
          options={SITE_STATUSES.map((s) => ({ value: s, label: SITE_STATUS_LABEL[s] }))}
          onChange={(v) => onChange({ siteStatus: SITE_STATUSES.find((s) => s === v) })}
        />
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-3 lg:grid-cols-4">
          <SelectFilter
            id="f-whatsapp"
            label="Tem WhatsApp"
            value={filters.hasWhatsapp}
            options={yesNo}
            onChange={(v) => onChange({ hasWhatsapp: v === "yes" || v === "no" ? v : undefined })}
          />
          <SelectFilter
            id="f-instagram"
            label="Tem Instagram"
            value={filters.hasInstagram}
            options={yesNo}
            onChange={(v) => onChange({ hasInstagram: v === "yes" || v === "no" ? v : undefined })}
          />
          <SelectFilter
            id="f-contacted"
            label="Contatado"
            value={filters.contacted}
            options={yesNo}
            onChange={(v) => onChange({ contacted: v === "yes" || v === "no" ? v : undefined })}
          />
          <SelectFilter
            id="f-stars"
            label="Oportunidade mínima"
            value={filters.minStars?.toString()}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} de 5 estrelas` }))}
            onChange={(v) => onChange({ minStars: v ? Number(v) : undefined })}
          />
          <Field id="f-rating" label="Nota mínima (0 a 5)">
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
          <Field id="f-min-reviews" label="Avaliações (mín.)">
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
          <Field id="f-max-reviews" label="Avaliações (máx.)">
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
          <SelectFilter
            id="f-search"
            label="Pesquisa de origem"
            value={filters.searchId}
            allLabel="Todas"
            options={(searches ?? []).map((s) => ({
              value: s.id,
              label: `${s.category} · ${s.city} (${formatDateTime(s.createdAt)})`,
            }))}
            onChange={(searchId) => onChange({ searchId })}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={showAdvanced}
          onClick={() => setExpanded((v) => !v)}
          disabled={advancedActive > 0}
        >
          {showAdvanced ? <ChevronUpIcon /> : <ChevronDownIcon />}
          {showAdvanced ? "Menos filtros" : "Mais filtros"}
        </Button>
        <Button size="sm" onClick={onClear} disabled={!hasFilters}>
          Limpar filtros
        </Button>
      </div>
    </form>
  );
}
