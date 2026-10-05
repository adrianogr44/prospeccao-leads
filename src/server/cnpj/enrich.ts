/**
 * Enriquecimento dos leads com o que já está na tabela `Cnpj`.
 *
 * Regras (story 1.6): só preenche campo vazio, o telefone do CNPJ vai para `phone` e nunca
 * para `whatsapp`, a origem fica registrada no lead e o score é recalculado em seguida.
 */
import type { SiteStatus } from "@/lib/contract";
import { db } from "../db";
import { parseStringArray } from "../leads/dto";
import { normalizeName } from "../leads/normalize";
import { scoreColumns } from "../leads/upsert";
import {
  contactUpdate,
  matchEstablishment,
  normalizeMunicipio,
  type CnpjCandidate,
  type MatchTarget,
} from "./match";
import { SITUACAO_ATIVA } from "./parse";

/** Leads examinados por rodada; o cursor avança de lote em lote. */
export const ENRICH_PAGE = 50;

/**
 * Teto de candidatos por lead. Acima disso o nome é genérico demais e o resultado seria
 * ambíguo de qualquer forma.
 */
const MAX_CANDIDATES = 25;

export interface EnrichStats {
  examined: number;
  matched: number;
  phone: number;
  email: number;
  ambiguous: number;
}

export const emptyStats = (): EnrichStats => ({ examined: 0, matched: 0, phone: 0, email: 0, ambiguous: 0 });

const CANDIDATE_SELECT = {
  cnpj: true,
  nomeFantasia: true,
  razaoSocial: true,
  nomeNormalizado: true,
  razaoNormalizada: true,
  bairro: true,
  logradouro: true,
  phone: true,
  phone2: true,
  email: true,
} as const;

/**
 * Nomes de cidade como aparecem nos leads, a partir dos nomes pedidos na importação
 * (o usuário digita "campinas", o lead guarda "Campinas").
 */
export async function resolveLeadCities(cities: string[]): Promise<string[]> {
  const wanted = new Set(cities.map(normalizeMunicipio));
  const groups = await db.lead.groupBy({ by: ["city"] });
  return groups
    .map((g) => g.city)
    .filter((city): city is string => city !== null && wanted.has(normalizeMunicipio(city)));
}

/** Candidatos do mesmo município (e UF, quando informada) cujo nome bate com o do lead. */
async function findCandidates(name: string, codes: string[], ufs: string[]): Promise<CnpjCandidate[]> {
  if (!name) return [];
  const rows = await db.cnpj.findMany({
    where: {
      municipio: { in: codes },
      situacao: SITUACAO_ATIVA,
      ...(ufs.length > 0 ? { uf: { in: ufs } } : {}),
      OR: [
        { nomeNormalizado: name },
        { razaoNormalizada: name },
        { nomeNormalizado: { startsWith: `${name} ` } },
        { razaoNormalizada: { startsWith: `${name} ` } },
      ],
    },
    select: CANDIDATE_SELECT,
    take: MAX_CANDIDATES,
  });
  return rows;
}

export interface EnrichRound {
  stats: EnrichStats;
  /** Id do último lead examinado; entra no cursor para a próxima rodada. */
  afterId: string | null;
  /** true quando não há mais leads a examinar. */
  finished: boolean;
}

/**
 * Examina um lote de leads depois de `afterId`. Só entram leads das cidades importadas que
 * ainda têm telefone ou e-mail vazio.
 *
 * A continuação é por id (não por `skip`): enriquecer um lead pode tirá-lo desse filtro, e um
 * deslocamento numérico passaria por cima dos seguintes.
 */
export async function enrichRound(
  leadCities: string[],
  codes: string[],
  ufs: string[],
  dumpMonth: string,
  afterId: string | null,
): Promise<EnrichRound> {
  const stats = emptyStats();
  if (leadCities.length === 0 || codes.length === 0) {
    return { stats, afterId, finished: true };
  }

  const leads = await db.lead.findMany({
    where: {
      city: { in: leadCities },
      OR: [{ phone: null }, { email: null }],
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: { id: "asc" },
    take: ENRICH_PAGE,
    select: {
      id: true,
      name: true,
      neighborhood: true,
      address: true,
      whatsapp: true,
      phone: true,
      email: true,
      source: true,
      siteStatus: true,
      siteSignals: true,
      rating: true,
      reviewCount: true,
      instagram: true,
      businessStatus: true,
    },
  });
  if (leads.length === 0) return { stats, afterId, finished: true };

  const sourceDate = dumpDate(dumpMonth);

  for (const lead of leads) {
    stats.examined++;
    const target: MatchTarget = { name: lead.name, neighborhood: lead.neighborhood, address: lead.address };
    const candidates = await findCandidates(normalizeName(lead.name), codes, ufs);
    const outcome = matchEstablishment(target, candidates);

    if (outcome.kind === "ambiguous") {
      stats.ambiguous++;
      continue;
    }
    if (outcome.kind === "none") continue;

    stats.matched++;
    const update = contactUpdate(lead, outcome.match.candidate);
    if (update.phone === undefined && update.email === undefined) continue;

    if (update.phone !== undefined) stats.phone++;
    if (update.email !== undefined) stats.email++;

    // O score não depende de telefone nem de e-mail, mas é recalculado para manter a regra
    // "score sempre refeito depois do enriquecimento"; o funil muda porque passa a ter contato.
    await db.lead.update({
      where: { id: lead.id },
      data: {
        ...update,
        contactSource: "receita",
        contactSourceAt: sourceDate,
        ...scoreColumns({
          source: lead.source,
          siteStatus: lead.siteStatus as SiteStatus,
          siteSignals: parseStringArray(lead.siteSignals),
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          whatsapp: lead.whatsapp,
          instagram: lead.instagram,
          businessStatus: lead.businessStatus,
        }),
      },
      select: { id: true },
    });
  }

  return { stats, afterId: leads[leads.length - 1].id, finished: leads.length < ENRICH_PAGE };
}

/** Primeiro dia do mês do dump: é a data que a interface mostra como idade do dado. */
export function dumpDate(dumpMonth: string): Date {
  const [year, month] = dumpMonth.split("-").map(Number);
  if (!year || !month) return new Date();
  return new Date(year, month - 1, 1);
}
