import type { Prisma } from "@prisma/client";
import { NEEDS_SITE_STATUSES, type LeadFilters, type LeadListQuery } from "@/lib/contract";

/** "Sem site" = NONE ou SOCIAL_ONLY. */
export const NO_SITE_STATUSES = ["NONE", "SOCIAL_ONLY"];

/** Precisa de site novo: sem site, só rede social, antigo ou fora do ar. */
export const NEEDS_SITE: string[] = [...NEEDS_SITE_STATUSES];

/** Tem algum contato para receber a proposta. */
export const HAS_CONTACT: Prisma.LeadWhereInput = {
  OR: [{ whatsapp: { not: null } }, { phone: { not: null } }, { email: { not: null } }],
};
const NO_CONTACT: Prisma.LeadWhereInput = { whatsapp: null, phone: null, email: null };

/** Único lugar que traduz filtros da API em where do Prisma (lista, indicadores e exportação). */
export function buildLeadWhere(f: LeadFilters): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [];

  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q } },
        { address: { contains: f.q } },
        { neighborhood: { contains: f.q } },
        { phone: { contains: f.q } },
      ],
    });
  }
  if (f.city) and.push({ city: f.city });
  if (f.state) and.push({ state: f.state });
  if (f.category) and.push({ category: f.category });
  if (f.searchId) and.push({ searches: { some: { searchId: f.searchId } } });
  if (f.siteStatus) and.push({ siteStatus: f.siteStatus });
  if (f.hasSite === "yes") and.push({ siteStatus: { notIn: NO_SITE_STATUSES } });
  if (f.hasSite === "no") and.push({ siteStatus: { in: NO_SITE_STATUSES } });
  if (f.hasWhatsapp === "yes") and.push({ whatsapp: { not: null } });
  if (f.hasWhatsapp === "no") and.push({ whatsapp: null });
  if (f.hasInstagram === "yes") and.push({ instagram: { not: null } });
  if (f.hasInstagram === "no") and.push({ instagram: null });
  if (f.contacted === "yes") and.push({ contactedAt: { not: null } });
  if (f.contacted === "no") and.push({ contactedAt: null });
  if (f.needsSite === "yes") and.push({ siteStatus: { in: NEEDS_SITE } });
  if (f.needsSite === "no") and.push({ siteStatus: { notIn: NEEDS_SITE } });
  if (f.hasContact === "yes") and.push(HAS_CONTACT);
  if (f.hasContact === "no") and.push(NO_CONTACT);
  if (f.minRating !== undefined) and.push({ rating: { gte: f.minRating } });
  if (f.maxRating !== undefined) and.push({ rating: { lte: f.maxRating } });
  if (f.minReviews !== undefined) and.push({ reviewCount: { gte: f.minReviews } });
  if (f.maxReviews !== undefined) and.push({ reviewCount: { lte: f.maxReviews } });
  if (f.minStars !== undefined) and.push({ stars: { gte: f.minStars } });

  return and.length ? { AND: and } : {};
}

/** Ordenação pedida + desempates estáveis (score/avaliações e id) para paginar sem repetir. */
export function buildLeadOrderBy(query: Pick<LeadListQuery, "sort" | "dir">): Prisma.LeadOrderByWithRelationInput[] {
  const primary: Prisma.LeadOrderByWithRelationInput = { [query.sort]: query.dir };
  const tiebreak: Prisma.LeadOrderByWithRelationInput[] =
    query.sort === "score" ? [{ reviewCount: "desc" }] : [{ score: "desc" }];
  return [primary, ...tiebreak, { id: "asc" }];
}
