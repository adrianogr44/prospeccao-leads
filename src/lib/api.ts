import type {
  ApiError,
  LeadDTO,
  LeadFilters,
  LeadListResponse,
  MetaResponse,
  ScheduleDTO,
  ScheduleInput,
  SearchDTO,
  SearchInput,
  SheetsExportResponse,
  StatsResponse,
} from "./contract";
import type { LEAD_SORT_FIELDS, EXPORT_FORMATS } from "./contract";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.details = details;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Algo deu errado. Tente de novo.";
}

async function readError(res: Response): Promise<ApiRequestError> {
  let message = `Algo deu errado (código ${res.status}).`;
  let details: unknown;
  try {
    const body = (await res.json()) as Partial<ApiError>;
    if (typeof body.error === "string" && body.error) message = body.error;
    details = body.details;
  } catch {
    // corpo sem JSON: mantém a mensagem padrão
  }
  return new ApiRequestError(message, res.status, details);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      cache: "no-store",
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiRequestError(
      "Não foi possível falar com o servidor. Confira se o sistema está rodando.",
      0,
    );
  }
  if (!res.ok) throw await readError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal });
}

function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// ---------- Query strings ----------

export type LeadSort = (typeof LEAD_SORT_FIELDS)[number];
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface LeadListParams extends LeadFilters {
  page?: number;
  pageSize?: number;
  sort?: LeadSort;
  dir?: "asc" | "desc";
}

export function toQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  return search.toString();
}

function withQuery(path: string, params: object): string {
  const query = toQuery(params);
  return query ? `${path}?${query}` : path;
}

// ---------- Caminhos (para uso com useApiGet) ----------

export const metaPath = "/api/meta";
export const searchesPath = "/api/searches";
export const schedulesPath = "/api/schedules";
export const leadsPath = (params: LeadListParams) => withQuery("/api/leads", params);
export const statsPath = (filters: LeadFilters) => withQuery("/api/stats", filters);
export const exportPath = (filters: LeadFilters, format: ExportFormat) =>
  withQuery("/api/export", { ...filters, format });

// ---------- Chamadas ----------

export const getMeta = (signal?: AbortSignal) => apiGet<MetaResponse>(metaPath, signal);
export const getLeads = (params: LeadListParams, signal?: AbortSignal) =>
  apiGet<LeadListResponse>(leadsPath(params), signal);
export const getStats = (filters: LeadFilters, signal?: AbortSignal) =>
  apiGet<StatsResponse>(statsPath(filters), signal);

export const saveLeadNotes = (id: string, notes: string | null) =>
  send<LeadDTO>("PATCH", `/api/leads/${encodeURIComponent(id)}`, { notes });
export const deleteLead = (id: string) =>
  send<void>("DELETE", `/api/leads/${encodeURIComponent(id)}`);

export const createSearch = (input: SearchInput) => send<SearchDTO>("POST", searchesPath, input);
export const actOnSearch = (id: string, action: "pause" | "resume") =>
  send<SearchDTO>("POST", `${searchesPath}/${encodeURIComponent(id)}`, { action });

export const createSchedule = (input: ScheduleInput) =>
  send<ScheduleDTO>("POST", schedulesPath, input);
export const setScheduleActive = (id: string, active: boolean) =>
  send<ScheduleDTO>("PATCH", `${schedulesPath}/${encodeURIComponent(id)}`, { active });
export const deleteSchedule = (id: string) =>
  send<void>("DELETE", `${schedulesPath}/${encodeURIComponent(id)}`);

export const exportToSheets = (spreadsheet: string, filters: LeadFilters) =>
  send<SheetsExportResponse>("POST", "/api/export/sheets", { spreadsheet, filters });
