import type { SiteStatus } from "@/lib/contract";

/** Todos os pesos em um lugar só. */
export const WEIGHTS = {
  // OSM quase nunca registra o site: ausência lá é indício, não confirmação
  osmNoSiteBase: 65,
  base: { NONE: 90, SOCIAL_ONLY: 85, OLD: 85, UNREACHABLE: 75, UNKNOWN: 50, OK: 25 } satisfies Record<SiteStatus, number>,
  fewReviews: { threshold: 20, bonus: 10 },
  noWhatsapp: 10,
  instagramWithoutSite: 5,
  healthyBusiness: { minRating: 4.3, minReviews: 50, bonus: 5 },
  cap: 100,
};

const STARS: Array<[minScore: number, stars: number]> = [
  [85, 5],
  [65, 4],
  [45, 3],
  [25, 2],
];

export interface ScoreInput {
  source: string;
  siteStatus: SiteStatus;
  siteSignals: string[];
  rating: number | null;
  reviewCount: number | null;
  whatsapp: string | null;
  instagram: string | null;
  businessStatus: string | null;
}

export interface ScoreResult {
  score: number;
  stars: number;
  reasons: string[];
}

export function starsFor(score: number): number {
  return STARS.find(([min]) => score >= min)?.[1] ?? 1;
}

function siteReasons(status: SiteStatus, signals: string[], unconfirmed: boolean): string[] {
  switch (status) {
    case "NONE":
      return [unconfirmed ? "Sem site cadastrado no OpenStreetMap (confirmar)" : "Não tem site"];
    case "SOCIAL_ONLY":
      return ["Só tem rede social, sem site próprio"];
    case "OLD":
      return ["Site antigo", ...signals];
    case "UNREACHABLE":
      return ["Site fora do ar"];
    case "UNKNOWN":
      return ["Site ainda não analisado"];
    case "OK":
      return ["Já tem site moderno"];
  }
}

export function scoreLead(lead: ScoreInput): ScoreResult {
  if (lead.businessStatus === "CLOSED_PERMANENTLY") {
    return { score: 0, stars: 1, reasons: ["Fechado permanentemente"] };
  }

  const unconfirmed = lead.source === "osm" && lead.siteStatus === "NONE";
  let score = unconfirmed ? WEIGHTS.osmNoSiteBase : WEIGHTS.base[lead.siteStatus];
  const reasons = siteReasons(lead.siteStatus, lead.siteSignals, unconfirmed);
  const noSite = lead.siteStatus === "NONE" || lead.siteStatus === "SOCIAL_ONLY";

  // reviewCount nulo = fonte sem dado (OSM): não pontua
  if (lead.reviewCount !== null && lead.reviewCount < WEIGHTS.fewReviews.threshold) {
    score += WEIGHTS.fewReviews.bonus;
    reasons.push(`Poucas avaliações (${lead.reviewCount})`);
  }
  if (!lead.whatsapp) {
    score += WEIGHTS.noWhatsapp;
    reasons.push("Sem WhatsApp divulgado");
  }
  if (lead.instagram && noSite) {
    score += WEIGHTS.instagramWithoutSite;
    reasons.push("Tem Instagram mas não tem site");
  }
  const h = WEIGHTS.healthyBusiness;
  if (lead.rating !== null && lead.reviewCount !== null && lead.rating >= h.minRating && lead.reviewCount >= h.minReviews) {
    score += h.bonus;
    reasons.push(`Negócio bem avaliado (${lead.rating.toFixed(1)} com ${lead.reviewCount} avaliações)`);
  }

  score = Math.min(WEIGHTS.cap, score);
  return { score, stars: starsFor(score), reasons };
}
