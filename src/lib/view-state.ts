import { LEAD_SORT_FIELDS, SITE_STATUSES, type LeadFilters } from "./contract";
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

export const DEFAULT_VIEW: ViewState = {
  filters: {},
  page: 1,
  pageSize: 50,
  sort: "score",
  dir: "desc",
};

const TEXT_KEYS = ["q", "city", "state", "category", "searchId"] as const;
const YES_NO_KEYS = ["hasSite", "hasWhatsapp", "hasInstagram", "contacted"] as const;

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
  for (const [key, value] of Object.entries(view.filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
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

/** Ordem inicial ao trocar de coluna: texto começa crescente, números decrescente. */
export function defaultDir(sort: LeadSort): "asc" | "desc" {
  return sort === "name" || sort === "city" || sort === "category" ? "asc" : "desc";
}
