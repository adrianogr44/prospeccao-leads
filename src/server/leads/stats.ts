import type { Prisma } from "@prisma/client";
import type { CountBy, LeadFilters, StatsResponse } from "@/lib/contract";
import { SITE_STATUSES } from "@/lib/contract";
import { db } from "../db";
import { buildLeadWhere, HAS_CONTACT, NEEDS_SITE, NO_SITE_STATUSES } from "./query";

const STARS = [1, 2, 3, 4, 5];

/** Indicadores dos leads filtrados: poucas agregações no banco, sem carregar linhas. */
export async function getStats(filters: LeadFilters): Promise<StatsResponse> {
  const base = buildLeadWhere(filters);
  const and = (extra: Prisma.LeadWhereInput): Prisma.LeadWhereInput => ({ AND: [base, extra] });

  // O funil ignora os filtros que ele mesmo aplica, para as etapas não encolherem quando uma é selecionada.
  const funnelBase = buildLeadWhere({ ...filters, needsSite: undefined, hasContact: undefined, contacted: undefined });
  const inFunnel = (extra: Prisma.LeadWhereInput): Prisma.LeadWhereInput => ({
    AND: [funnelBase, { siteStatus: { in: NEEDS_SITE } }, extra],
  });

  const [total, bySite, byStars, byCity, byCategory, byPlatform, withWhatsapp, instagramOnly, funnel] = await Promise.all([
    db.lead.count({ where: base }),
    db.lead.groupBy({ by: ["siteStatus"], where: base, _count: { _all: true } }),
    db.lead.groupBy({ by: ["stars"], where: base, _count: { _all: true } }),
    db.lead.groupBy({
      by: ["city"],
      where: and({ city: { not: null } }),
      _count: { _all: true },
      orderBy: { _count: { city: "desc" } },
      take: 10,
    }),
    db.lead.groupBy({
      by: ["category"],
      where: and({ category: { not: null } }),
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
      take: 10,
    }),
    db.lead.groupBy({
      by: ["sitePlatform"],
      where: and({ sitePlatform: { not: null } }),
      _count: { _all: true },
      orderBy: { _count: { sitePlatform: "desc" } },
      take: 8,
    }),
    db.lead.count({ where: and({ whatsapp: { not: null } }) }),
    db.lead.count({ where: and({ instagram: { not: null }, siteStatus: { in: NO_SITE_STATUSES } }) }),
    Promise.all([
      db.lead.count({ where: funnelBase }),
      db.lead.count({ where: inFunnel({}) }),
      db.lead.count({ where: inFunnel(HAS_CONTACT) }),
      db.lead.count({ where: inFunnel({ AND: [HAS_CONTACT, { contactedAt: null }] }) }),
      db.lead.count({ where: inFunnel({ contactedAt: { not: null } }) }),
    ]),
  ]);
  const [found, needsSite, reachable, ready, contacted] = funnel;

  const siteCount = new Map(bySite.map((r) => [r.siteStatus, r._count._all]));
  const starCount = new Map(byStars.map((r) => [r.stars, r._count._all]));
  const sum = (statuses: string[]) => statuses.reduce((acc, s) => acc + (siteCount.get(s) ?? 0), 0);
  const withoutSite = sum(NO_SITE_STATUSES);

  const ranked = <K extends "city" | "category" | "sitePlatform">(
    rows: Array<{ _count: { _all: number } } & Record<K, string | null>>,
    key: K,
  ): CountBy[] => rows.flatMap((r) => (r[key] ? [{ label: r[key] as string, count: r._count._all }] : []));

  return {
    total,
    withSite: total - withoutSite,
    withoutSite,
    oldSite: sum(["OLD", "UNREACHABLE"]),
    withWhatsapp,
    withoutWhatsapp: total - withWhatsapp,
    instagramOnly,
    hotLeads: starCount.get(5) ?? 0,
    // Rótulos de siteStatus são os códigos; a interface traduz com SITE_STATUS_LABEL
    bySiteStatus: SITE_STATUSES.map((s) => ({ label: s, count: siteCount.get(s) ?? 0 })).filter((c) => c.count > 0),
    byStars: STARS.map((s) => ({ label: String(s), count: starCount.get(s) ?? 0 })),
    byCity: ranked(byCity, "city"),
    byCategory: ranked(byCategory, "category"),
    byPlatform: ranked(byPlatform, "sitePlatform"),
    funnel: { found, needsSite, reachable, ready, contacted },
  };
}
