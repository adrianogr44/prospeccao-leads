import type { Prisma } from "@prisma/client";
import type { SiteStatus } from "@/lib/contract";
import { db } from "../db";
import { scoreLead, type ScoreInput } from "../scoring/score";
import { isMobileBR, type NormalizedPlace } from "./normalize";
import { parseStringArray } from "./dto";

export interface UpsertStats {
  /** Leads ligados pela primeira vez a esta pesquisa */
  found: number;
  created: number;
  updated: number;
  /** Todos os leads tocados (para enriquecer depois) */
  leadIds: string[];
}

/** Colunas de score prontas para gravar; único ponto que converte ScoreResult em colunas. */
export function scoreColumns(input: ScoreInput): { score: number; stars: number; scoreReasons: string } {
  const { score, stars, reasons } = scoreLead(input);
  return { score, stars, scoreReasons: JSON.stringify(reasons) };
}

const MERGE_FIELDS = [
  "id",
  "category",
  "city",
  "state",
  "neighborhood",
  "address",
  "postalCode",
  "lat",
  "lng",
  "mapsUrl",
  "businessStatus",
  "website",
  "siteStatus",
  "sitePlatform",
  "siteSignals",
  "rating",
  "reviewCount",
  "openingHours",
  "whatsapp",
  "phone",
  "email",
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "ownerName",
] as const;

const MERGE_SELECT = Object.fromEntries(MERGE_FIELDS.map((k) => [k, true])) as Record<(typeof MERGE_FIELDS)[number], true>;

type ExistingLead = Prisma.LeadGetPayload<{ select: typeof MERGE_SELECT }>;

const pick = <T>(incoming: T | null, current: T | null): T | null => incoming ?? current;

function scoreOf(row: {
  source: string;
  siteStatus: string;
  siteSignals: string | null;
  rating: number | null;
  reviewCount: number | null;
  whatsapp: string | null;
  instagram: string | null;
  businessStatus: string | null;
}) {
  return scoreColumns({
    source: row.source,
    siteStatus: row.siteStatus as SiteStatus,
    siteSignals: parseStringArray(row.siteSignals),
    rating: row.rating,
    reviewCount: row.reviewCount,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    businessStatus: row.businessStatus,
  });
}

function createData(p: NormalizedPlace): Prisma.LeadCreateInput {
  return {
    source: p.source,
    externalId: p.externalId,
    dedupeKey: p.dedupeKey,
    name: p.name,
    category: p.category,
    city: p.city,
    state: p.state,
    neighborhood: p.neighborhood,
    address: p.address,
    postalCode: p.postalCode,
    lat: p.lat,
    lng: p.lng,
    mapsUrl: p.mapsUrl,
    businessStatus: p.businessStatus,
    website: p.website,
    siteStatus: p.siteStatus,
    rating: p.rating,
    reviewCount: p.reviewCount,
    openingHours: p.openingHours,
    whatsapp: p.whatsapp,
    phone: p.phone,
    phoneIsMobile: p.phoneIsMobile,
    email: p.email,
    facebook: p.facebook,
    instagram: p.instagram,
    linkedin: p.linkedin,
    tiktok: p.tiktok,
    ownerName: p.ownerName,
    ...scoreOf({ ...p, siteSignals: null }),
  };
}

/** Mesma fonte, mesmo lugar: dados novos vencem; campos que a fonte não trouxe são preservados (e as notas). */
function updateFromSameSource(ex: ExistingLead, p: NormalizedPlace): Prisma.LeadUpdateInput {
  const merged = {
    category: pick(p.category, ex.category),
    city: pick(p.city, ex.city),
    state: pick(p.state, ex.state),
    neighborhood: pick(p.neighborhood, ex.neighborhood),
    address: pick(p.address, ex.address),
    postalCode: pick(p.postalCode, ex.postalCode),
    lat: pick(p.lat, ex.lat),
    lng: pick(p.lng, ex.lng),
    mapsUrl: pick(p.mapsUrl, ex.mapsUrl),
    businessStatus: pick(p.businessStatus, ex.businessStatus),
    rating: pick(p.rating, ex.rating),
    reviewCount: pick(p.reviewCount, ex.reviewCount),
    openingHours: pick(p.openingHours, ex.openingHours),
    whatsapp: pick(p.whatsapp, ex.whatsapp),
    phone: pick(p.phone, ex.phone),
    email: pick(p.email, ex.email),
    facebook: pick(p.facebook, ex.facebook),
    instagram: pick(p.instagram, ex.instagram),
    linkedin: ex.linkedin,
    tiktok: ex.tiktok,
    ownerName: pick(p.ownerName, ex.ownerName),
  };

  // Site igual e já analisado: mantém a análise. Site mudou: volta para o estado base e reanalisa.
  const sameSite = p.website !== null && p.website === ex.website;
  const site = sameSite
    ? { website: ex.website, siteStatus: ex.siteStatus, sitePlatform: ex.sitePlatform, siteSignals: ex.siteSignals }
    : { website: p.website, siteStatus: p.siteStatus, sitePlatform: null, siteSignals: null, enrichedAt: null };

  return {
    ...merged,
    ...site,
    name: p.name,
    dedupeKey: p.dedupeKey,
    phoneIsMobile: isMobileBR(merged.phone),
    fetchedAt: new Date(),
    ...scoreOf({ ...merged, source: p.source, siteStatus: site.siteStatus, siteSignals: site.siteSignals }),
  };
}

/** Outra fonte, mesma empresa: só preenche o que está vazio no lead existente. */
function fillEmptyFromOtherSource(ex: ExistingLead, p: NormalizedPlace): Prisma.LeadUpdateInput {
  const merged = {
    category: pick(ex.category, p.category),
    city: pick(ex.city, p.city),
    state: pick(ex.state, p.state),
    neighborhood: pick(ex.neighborhood, p.neighborhood),
    address: pick(ex.address, p.address),
    postalCode: pick(ex.postalCode, p.postalCode),
    lat: pick(ex.lat, p.lat),
    lng: pick(ex.lng, p.lng),
    mapsUrl: pick(ex.mapsUrl, p.mapsUrl),
    businessStatus: pick(ex.businessStatus, p.businessStatus),
    rating: pick(ex.rating, p.rating),
    reviewCount: pick(ex.reviewCount, p.reviewCount),
    openingHours: pick(ex.openingHours, p.openingHours),
    whatsapp: pick(ex.whatsapp, p.whatsapp),
    phone: pick(ex.phone, p.phone),
    email: pick(ex.email, p.email),
    facebook: pick(ex.facebook, p.facebook),
    instagram: pick(ex.instagram, p.instagram),
    linkedin: ex.linkedin,
    tiktok: ex.tiktok,
    ownerName: pick(ex.ownerName, p.ownerName),
  };

  // Ganhou um site que não tinha: precisa ser analisado.
  const gainedSite = ex.website === null && p.website !== null;
  const site = gainedSite
    ? { website: p.website, siteStatus: "UNKNOWN", sitePlatform: null, siteSignals: null, enrichedAt: null }
    : { website: ex.website, siteStatus: ex.siteStatus, sitePlatform: ex.sitePlatform, siteSignals: ex.siteSignals };

  return {
    ...merged,
    ...site,
    phoneIsMobile: isMobileBR(merged.phone),
    // fontes diferentes: uma delas é o Google, que confirma a ausência de site
    ...scoreOf({ ...merged, source: "google", siteStatus: site.siteStatus, siteSignals: site.siteSignals }),
  };
}

/**
 * Grava as empresas de uma célula (uma fonte por chamada):
 * ignora bloqueadas, atualiza pela chave (source, externalId), funde entre fontes pelo dedupeKey
 * e registra o vínculo com a pesquisa.
 */
export async function upsertPlaces(searchId: string, places: NormalizedPlace[]): Promise<UpsertStats> {
  const stats: UpsertStats = { found: 0, created: 0, updated: 0, leadIds: [] };
  if (places.length === 0) return stats;

  const source = places[0].source;
  const unique = [...new Map(places.map((p) => [p.externalId, p])).values()];
  const ids = unique.map((p) => p.externalId);

  const [blocked, sameSource] = await Promise.all([
    db.blocked.findMany({ where: { source, externalId: { in: ids } }, select: { externalId: true } }),
    db.lead.findMany({ where: { source, externalId: { in: ids } }, select: { ...MERGE_SELECT, externalId: true } }),
  ]);
  const blockedIds = new Set(blocked.map((b) => b.externalId));
  const byExternalId = new Map(sameSource.map((l) => [l.externalId, l]));

  const candidates = unique.filter((p) => !blockedIds.has(p.externalId));
  const unmatched = candidates.filter((p) => !byExternalId.has(p.externalId));
  const crossSource = unmatched.length
    ? await db.lead.findMany({
        where: { source: { not: source }, dedupeKey: { in: unmatched.map((p) => p.dedupeKey) } },
        select: { ...MERGE_SELECT, dedupeKey: true },
      })
    : [];
  const byDedupeKey = new Map(crossSource.map((l) => [l.dedupeKey, l]));

  const touched = await db.$transaction(
    async (tx) => {
      const out: Array<{ id: string; created: boolean }> = [];
      for (const p of candidates) {
        const same = byExternalId.get(p.externalId);
        const cross = same ? undefined : byDedupeKey.get(p.dedupeKey);
        if (same) {
          await tx.lead.update({ where: { id: same.id }, data: updateFromSameSource(same, p), select: { id: true } });
          out.push({ id: same.id, created: false });
        } else if (cross) {
          await tx.lead.update({ where: { id: cross.id }, data: fillEmptyFromOtherSource(cross, p), select: { id: true } });
          out.push({ id: cross.id, created: false });
        } else {
          const lead = await tx.lead.create({ data: createData(p), select: { id: true } });
          out.push({ id: lead.id, created: true });
        }
      }
      return out;
    },
    { timeout: 30_000 },
  );

  // Vínculo com a pesquisa: só o que ainda não estava ligado conta como "encontrado" nesta pesquisa.
  const leadIds = [...new Set(touched.map((t) => t.id))];
  const linked = new Set(
    (await db.searchLead.findMany({ where: { searchId, leadId: { in: leadIds } }, select: { leadId: true } })).map((l) => l.leadId),
  );
  const fresh = touched.filter((t, i) => !linked.has(t.id) && touched.findIndex((o) => o.id === t.id) === i);
  if (fresh.length) {
    await db.searchLead.createMany({
      data: fresh.map((t) => ({ searchId, leadId: t.id, isNew: t.created })),
    });
  }

  stats.leadIds = leadIds;
  stats.found = fresh.length;
  stats.created = fresh.filter((t) => t.created).length;
  stats.updated = fresh.filter((t) => !t.created).length;
  return stats;
}
