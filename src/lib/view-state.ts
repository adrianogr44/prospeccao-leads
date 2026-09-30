import { LEAD_SORT_FIELDS, SITE_STATUSES, type FunnelStats, type LeadFilters } from "./contract";
import type { LeadSort } from "./api";

/** Estado do dashboard que vive na URL: filtros, ordenação e paginação. */
export interface ViewState {
  filters: LeadFilters;
  page: number;
  pageSize: number;
  sort: LeadSort;
  dir: "asc" | "desc";
}

export const PAGE_SIZES = [10, 25, 50, 100, 200] as const;

// ---------- Funil ----------

/** Filtros que as etapas do funil gravam. O funil é calculado sem eles. */
export const STAGE_KEYS = ["needsSite", "hasContact", "contacted"] as const;
type StageKey = (typeof STAGE_KEYS)[number];
type StageFilters = Pick<LeadFilters, StageKey>;

export type FunnelStage = keyof FunnelStats;

export const FUNNEL_STAGES: ReadonlyArray<{ id: FunnelStage; label: string; filters: StageFilters }> = [
  { id: "found", label: "Encontradas", filters: {} },
  { id: "needsSite", label: "Precisam de site", filters: { needsSite: "yes" } },
  { id: "reachable", label: "Com contato", filters: { needsSite: "yes", hasContact: "yes" } },
  { id: "ready", label: "Prontas para abordar", filters: { needsSite: "yes", hasContact: "yes", contacted: "no" } },
  { id: "contacted", label: "Contatadas", filters: { needsSite: "yes", contacted: "yes" } },
];

/** Etapa inicial (qualquer URL sem needsSite, hasContact, contacted e `todas`). */
export const READY_FILTERS: StageFilters = { needsSite: "yes", hasContact: "yes", contacted: "no" };

/** Fila de trabalho para achar o WhatsApp à mão: precisam de site e estão sem contato. */
export const LEAK_FILTERS: StageFilters = { needsSite: "yes", hasContact: "no" };

const sameStage = (filters: LeadFilters, stage: StageFilters) =>
  STAGE_KEYS.every((key) => filters[key] === stage[key]);

/** Etapa que bate exatamente com os filtros de etapa atuais, ou null (os filtros viram chips). */
export function activeStage(filters: LeadFilters): FunnelStage | null {
  return FUNNEL_STAGES.find((stage) => sameStage(filters, stage.filters))?.id ?? null;
}

/** Filtros com a etapa trocada (os demais filtros ficam). */
export function withStage(filters: LeadFilters, stage: FunnelStage): LeadFilters {
  const target = FUNNEL_STAGES.find((s) => s.id === stage)?.filters ?? {};
  return patchFilters(filters, { needsSite: undefined, hasContact: undefined, contacted: undefined, ...target });
}

/** Filtros-base: todos menos os de etapa (usados pelo funil e pela camada de contexto do mapa). */
export function baseFilters(filters: LeadFilters): LeadFilters {
  return patchFilters(filters, { needsSite: undefined, hasContact: undefined, contacted: undefined });
}

// ---------- URL ----------

export const DEFAULT_VIEW: ViewState = {
  filters: { ...READY_FILTERS },
  page: 1,
  pageSize: 50,
  sort: "score",
  dir: "desc",
};

const TEXT_KEYS = ["q", "city", "state", "category", "searchId"] as const;
const YES_NO_KEYS = ["hasSite", "hasWhatsapp", "hasInstagram", "contacted", "needsSite", "hasContact"] as const;

function int(value: string | null, min: number, max: number): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

function decimal(value: string | null, min: number, max: number): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

/**
 * Lê a URL. Sem nenhum filtro de etapa e sem `todas=1`, abre na etapa "Prontas para abordar".
 * `todas` é parâmetro só da interface (não vai para a API): guarda o "sem etapa" ao recarregar.
 */
export function parseView(params: URLSearchParams): ViewState {
  const filters: LeadFilters = {};

  for (const key of TEXT_KEYS) {
    const value = params.get(key)?.trim();
    if (value) filters[key] = value;
  }
  for (const key of YES_NO_KEYS) {
    const value = params.get(key);
    if (value === "yes" || value === "no") filters[key] = value;
  }

  const siteStatus = params.get("siteStatus");
  const knownStatus = SITE_STATUSES.find((status) => status === siteStatus);
  if (knownStatus) filters.siteStatus = knownStatus;

  const minRating = decimal(params.get("minRating"), 0, 5);
  if (minRating !== undefined) filters.minRating = minRating;
  const maxRating = decimal(params.get("maxRating"), 0, 5);
  if (maxRating !== undefined) filters.maxRating = maxRating;
  const minReviews = int(params.get("minReviews"), 0, Number.MAX_SAFE_INTEGER);
  if (minReviews !== undefined) filters.minReviews = minReviews;
  const maxReviews = int(params.get("maxReviews"), 0, Number.MAX_SAFE_INTEGER);
  if (maxReviews !== undefined) filters.maxReviews = maxReviews;
  const minStars = int(params.get("minStars"), 1, 5);
  if (minStars !== undefined) filters.minStars = minStars;

  const hasStage = STAGE_KEYS.some((key) => filters[key] !== undefined);
  if (!hasStage && params.get("todas") !== "1") Object.assign(filters, READY_FILTERS);

  const sort = LEAD_SORT_FIELDS.find((field) => field === params.get("sort")) ?? DEFAULT_VIEW.sort;
  const dir = params.get("dir") === "asc" ? "asc" : params.get("dir") === "desc" ? "desc" : DEFAULT_VIEW.dir;

  return {
    filters,
    page: int(params.get("page"), 1, Number.MAX_SAFE_INTEGER) ?? DEFAULT_VIEW.page,
    pageSize: int(params.get("pageSize"), 10, 200) ?? DEFAULT_VIEW.pageSize,
    sort,
    dir,
  };
}

/** Serializa só o que difere do padrão, para manter a URL curta. */
export function viewToParams(view: ViewState): URLSearchParams {
  const params = new URLSearchParams();
  const isDefaultStage = sameStage(view.filters, READY_FILTERS);
  for (const [key, value] of Object.entries(view.filters)) {
    if (value === undefined || value === "") continue;
    if (isDefaultStage && (STAGE_KEYS as readonly string[]).includes(key)) continue;
    params.set(key, String(value));
  }
  if (STAGE_KEYS.every((key) => view.filters[key] === undefined)) params.set("todas", "1");
  if (view.sort !== DEFAULT_VIEW.sort) params.set("sort", view.sort);
  if (view.dir !== DEFAULT_VIEW.dir) params.set("dir", view.dir);
  if (view.page !== DEFAULT_VIEW.page) params.set("page", String(view.page));
  if (view.pageSize !== DEFAULT_VIEW.pageSize) params.set("pageSize", String(view.pageSize));
  return params;
}

/** Aplica um patch aos filtros; valores `undefined` removem o filtro. */
export function patchFilters(filters: LeadFilters, patch: Partial<LeadFilters>): LeadFilters {
  const next: LeadFilters = { ...filters, ...patch };
  for (const key of Object.keys(next) as Array<keyof LeadFilters>) {
    if (next[key] === undefined) delete next[key];
  }
  return next;
}

/** Ordem inicial ao trocar de campo: texto começa crescente, números decrescente. */
export function defaultDir(sort: LeadSort): "asc" | "desc" {
  return sort === "name" || sort === "city" || sort === "category" ? "asc" : "desc";
}
