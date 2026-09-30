/**
 * Contrato único entre backend (rotas em src/app/api) e frontend.
 * Qualquer mudança de formato de API passa por aqui primeiro.
 */
import { z } from "zod";

// ---------- Valores fixos ----------

export const SITE_STATUSES = [
  "UNKNOWN", // tem site, ainda não analisado
  "NONE", // não tem site
  "SOCIAL_ONLY", // o "site" é só Instagram/Facebook/Linktree/WhatsApp
  "OLD", // site parece antigo (heurística)
  "UNREACHABLE", // site fora do ar
  "OK", // site moderno
] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const SITE_STATUS_LABEL: Record<SiteStatus, string> = {
  UNKNOWN: "Não analisado",
  NONE: "Sem site",
  SOCIAL_ONLY: "Só rede social",
  OLD: "Site antigo",
  UNREACHABLE: "Site fora do ar",
  OK: "Site moderno",
};

export const SEARCH_STATUSES = ["queued", "running", "paused", "done", "failed"] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];

export const PROVIDERS = ["auto", "google", "osm"] as const;
export type ProviderChoice = (typeof PROVIDERS)[number];
export type LeadSource = "google" | "osm";

export const FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

// ---------- Pesquisa ----------

export const searchInputSchema = z.object({
  category: z.string().trim().min(2).max(80),
  keywords: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().max(40).optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(10),
  provider: z.enum(PROVIDERS).default("auto"),
  maxLeads: z.coerce.number().int().min(10).max(5000).default(500),
});
export type SearchInput = z.infer<typeof searchInputSchema>;

export interface SearchDTO extends SearchInput {
  id: string;
  status: SearchStatus;
  error: string | null;
  foundCount: number;
  newCount: number;
  updatedCount: number;
  requestCount: number;
  enrichedCount: number;
  /** 0-100, estimado pelas células da grade já processadas */
  progress: number;
  scheduleId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export const searchActionSchema = z.object({ action: z.enum(["pause", "resume"]) });

// ---------- Leads ----------

export interface LeadDTO {
  id: string;
  source: LeadSource;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  address: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  businessStatus: string | null;
  website: string | null;
  siteStatus: SiteStatus;
  sitePlatform: string | null;
  siteSignals: string[];
  rating: number | null;
  reviewCount: number | null;
  openingHours: string | null;
  whatsapp: string | null;
  phone: string | null;
  phoneIsMobile: boolean;
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  tiktok: string | null;
  ownerName: string | null;
  notes: string | null;
  score: number;
  stars: number;
  scoreReasons: string[];
  fetchedAt: string;
  updatedAt: string;
}

const triState = z.enum(["yes", "no"]).optional();

/** Filtros compartilhados por /api/leads, /api/stats e /api/export (query string). */
export const leadFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(), // busca livre: nome, endereço, bairro, telefone
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  category: z.string().trim().optional(),
  searchId: z.string().trim().optional(),
  siteStatus: z.enum(SITE_STATUSES).optional(),
  hasSite: triState, // "no" = NONE ou SOCIAL_ONLY
  hasWhatsapp: triState,
  hasInstagram: triState,
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxRating: z.coerce.number().min(0).max(5).optional(),
  minReviews: z.coerce.number().int().min(0).optional(),
  maxReviews: z.coerce.number().int().min(0).optional(),
  minStars: z.coerce.number().int().min(1).max(5).optional(),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

export const LEAD_SORT_FIELDS = [
  "score",
  "name",
  "city",
  "category",
  "rating",
  "reviewCount",
  "updatedAt",
] as const;

export const leadListQuerySchema = leadFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
  sort: z.enum(LEAD_SORT_FIELDS).default("score"),
  dir: z.enum(["asc", "desc"]).default("desc"),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

export interface LeadListResponse {
  items: LeadDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export const leadPatchSchema = z.object({ notes: z.string().max(2000).nullable() });

// ---------- Indicadores ----------

export interface CountBy {
  label: string;
  count: number;
}

export interface StatsResponse {
  total: number;
  withSite: number;
  withoutSite: number; // NONE + SOCIAL_ONLY
  oldSite: number; // OLD + UNREACHABLE
  withWhatsapp: number;
  withoutWhatsapp: number;
  instagramOnly: number; // tem Instagram e não tem site
  hotLeads: number; // 5 estrelas
  bySiteStatus: CountBy[];
  byStars: CountBy[]; // labels "1".."5"
  byCity: CountBy[]; // top 10
  byCategory: CountBy[]; // top 10
  byPlatform: CountBy[]; // top 8
}

// ---------- Opções de filtro e configuração ----------

export interface MetaResponse {
  cities: string[];
  states: string[];
  categories: string[];
  config: {
    googlePlaces: boolean; // chave configurada
    googleSheets: boolean; // conta de serviço configurada
    serviceAccountEmail: string | null;
  };
}

// ---------- Exportação ----------

export const EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export const exportQuerySchema = leadFiltersSchema.extend({
  format: z.enum(EXPORT_FORMATS).default("xlsx"),
});

export const sheetsExportSchema = z.object({
  /** ID ou URL completa da planilha, já compartilhada com a conta de serviço */
  spreadsheet: z.string().trim().min(10),
  filters: leadFiltersSchema.default({}),
});
export interface SheetsExportResponse {
  url: string;
  rows: number;
  sheetTitle: string;
}

// ---------- Agendamentos ----------

export const scheduleInputSchema = searchInputSchema.extend({
  frequency: z.enum(FREQUENCIES),
  hour: z.coerce.number().int().min(0).max(23).default(3),
  active: z.boolean().default(true),
});
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export const schedulePatchSchema = z.object({ active: z.boolean() });

export interface ScheduleDTO extends ScheduleInput {
  id: string;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
}

// ---------- Erro padrão ----------

export interface ApiError {
  error: string;
  details?: unknown;
}

/*
 * Rotas
 *
 * GET    /api/meta                      -> MetaResponse
 * GET    /api/leads?{LeadListQuery}     -> LeadListResponse
 * PATCH  /api/leads/:id   {notes}       -> LeadDTO
 * DELETE /api/leads/:id                 -> 204 (exclui e bloqueia reimportação)
 * GET    /api/stats?{LeadFilters}       -> StatsResponse
 * GET    /api/export?{filtros}&format=  -> arquivo (csv | xlsx | json)
 * POST   /api/export/sheets             -> SheetsExportResponse
 * GET    /api/searches                  -> SearchDTO[] (mais recentes primeiro, máx. 100)
 * POST   /api/searches    {SearchInput} -> SearchDTO (201, já enfileirada)
 * GET    /api/searches/:id              -> SearchDTO
 * POST   /api/searches/:id {action}     -> SearchDTO (pause | resume)
 * GET    /api/schedules                 -> ScheduleDTO[]
 * POST   /api/schedules   {ScheduleInput} -> ScheduleDTO (201)
 * PATCH  /api/schedules/:id {active}    -> ScheduleDTO
 * DELETE /api/schedules/:id             -> 204
 *
 * Erros: status 4xx/5xx com corpo ApiError.
 */
