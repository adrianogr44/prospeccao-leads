import type { Prisma } from "@prisma/client";
import type {
  Frequency,
  LeadDTO,
  LeadSource,
  ProviderChoice,
  ScheduleDTO,
  SearchDTO,
  SearchStatus,
  SiteStatus,
} from "@/lib/contract";
import { parseCursor, progressFromCursor } from "../providers/grid";

/** Só as colunas que o LeadDTO usa (sem dedupeKey e enrichedAt). */
export const LEAD_SELECT = {
  id: true,
  source: true,
  name: true,
  category: true,
  city: true,
  state: true,
  neighborhood: true,
  address: true,
  postalCode: true,
  lat: true,
  lng: true,
  mapsUrl: true,
  businessStatus: true,
  website: true,
  siteStatus: true,
  sitePlatform: true,
  siteSignals: true,
  rating: true,
  reviewCount: true,
  openingHours: true,
  whatsapp: true,
  phone: true,
  phoneIsMobile: true,
  email: true,
  facebook: true,
  instagram: true,
  linkedin: true,
  tiktok: true,
  ownerName: true,
  notes: true,
  score: true,
  stars: true,
  scoreReasons: true,
  fetchedAt: true,
  updatedAt: true,
} satisfies Prisma.LeadSelect;

export type LeadRow = Prisma.LeadGetPayload<{ select: typeof LEAD_SELECT }>;

export function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const json: unknown = JSON.parse(raw);
    return Array.isArray(json) ? json.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function toLeadDTO(row: LeadRow): LeadDTO {
  return {
    id: row.id,
    source: row.source as LeadSource,
    name: row.name,
    category: row.category,
    city: row.city,
    state: row.state,
    neighborhood: row.neighborhood,
    address: row.address,
    postalCode: row.postalCode,
    lat: row.lat,
    lng: row.lng,
    mapsUrl: row.mapsUrl,
    businessStatus: row.businessStatus,
    website: row.website,
    siteStatus: row.siteStatus as SiteStatus,
    sitePlatform: row.sitePlatform,
    siteSignals: parseStringArray(row.siteSignals),
    rating: row.rating,
    reviewCount: row.reviewCount,
    openingHours: row.openingHours,
    whatsapp: row.whatsapp,
    phone: row.phone,
    phoneIsMobile: row.phoneIsMobile,
    email: row.email,
    facebook: row.facebook,
    instagram: row.instagram,
    linkedin: row.linkedin,
    tiktok: row.tiktok,
    ownerName: row.ownerName,
    notes: row.notes,
    score: row.score,
    stars: row.stars,
    scoreReasons: parseStringArray(row.scoreReasons),
    fetchedAt: row.fetchedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const SEARCH_SELECT = {
  id: true,
  category: true,
  keywords: true,
  city: true,
  state: true,
  radiusKm: true,
  provider: true,
  maxLeads: true,
  status: true,
  error: true,
  cursor: true,
  foundCount: true,
  newCount: true,
  updatedCount: true,
  requestCount: true,
  enrichedCount: true,
  scheduleId: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
} satisfies Prisma.SearchSelect;

export type SearchRow = Prisma.SearchGetPayload<{ select: typeof SEARCH_SELECT }>;

export function toSearchDTO(row: SearchRow): SearchDTO {
  const status = row.status as SearchStatus;
  return {
    id: row.id,
    category: row.category,
    keywords: row.keywords ?? undefined,
    city: row.city,
    state: row.state ?? undefined,
    radiusKm: row.radiusKm,
    provider: row.provider as ProviderChoice,
    maxLeads: row.maxLeads,
    status,
    error: row.error,
    foundCount: row.foundCount,
    newCount: row.newCount,
    updatedCount: row.updatedCount,
    requestCount: row.requestCount,
    enrichedCount: row.enrichedCount,
    progress: status === "done" ? 100 : progressFromCursor(parseCursor(row.cursor)),
    scheduleId: row.scheduleId,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export const SCHEDULE_SELECT = {
  id: true,
  category: true,
  keywords: true,
  city: true,
  state: true,
  radiusKm: true,
  provider: true,
  maxLeads: true,
  frequency: true,
  hour: true,
  active: true,
  lastRunAt: true,
  nextRunAt: true,
  createdAt: true,
} satisfies Prisma.ScheduleSelect;

export type ScheduleRow = Prisma.ScheduleGetPayload<{ select: typeof SCHEDULE_SELECT }>;

export function toScheduleDTO(row: ScheduleRow): ScheduleDTO {
  return {
    id: row.id,
    category: row.category,
    keywords: row.keywords ?? undefined,
    city: row.city,
    state: row.state ?? undefined,
    radiusKm: row.radiusKm,
    provider: row.provider as ProviderChoice,
    maxLeads: row.maxLeads,
    frequency: row.frequency as Frequency,
    hour: row.hour,
    active: row.active,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
