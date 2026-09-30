import type { Prisma } from "@prisma/client";
import type { SiteStatus } from "@/lib/contract";
import { db } from "../db";
import { scoreColumns } from "../leads/upsert";
import { analyzeSite } from "./analyze";
import { extractContacts } from "./contacts";
import { fetchSite } from "./fetch-site";
import { detectPlatform } from "./platform";

const CONCURRENCY = 5;

const SELECT = {
  id: true,
  source: true,
  website: true,
  rating: true,
  reviewCount: true,
  whatsapp: true,
  instagram: true,
  facebook: true,
  linkedin: true,
  tiktok: true,
  email: true,
  businessStatus: true,
} satisfies Prisma.LeadSelect;

type Row = Prisma.LeadGetPayload<{ select: typeof SELECT }>;

/** Analisa o site de um lead e grava status, plataforma, contatos (só campos vazios) e score. */
async function enrichOne(lead: Row): Promise<boolean> {
  if (!lead.website) return false;
  const result = await fetchSite(lead.website);
  const now = new Date();

  if (result.kind === "unknown") {
    // Não deu para analisar: mantém UNKNOWN, mas registra a tentativa para não repetir.
    await db.lead.update({ where: { id: lead.id }, data: { enrichedAt: now }, select: { id: true } });
    return false;
  }

  let siteStatus: SiteStatus = "UNREACHABLE";
  let signals: string[] = [];
  let platform: string | null = null;
  const filled: Prisma.LeadUpdateInput = {};
  const contacts = { whatsapp: lead.whatsapp, instagram: lead.instagram, facebook: lead.facebook };

  if (result.kind === "ok") {
    const analysis = analyzeSite({ html: result.html, finalUrl: result.finalUrl, lastModified: result.lastModified });
    siteStatus = analysis.status;
    signals = analysis.signals;
    platform = detectPlatform(result.html);

    const found = extractContacts(result.html);
    if (!lead.whatsapp && found.whatsapp) filled.whatsapp = contacts.whatsapp = found.whatsapp;
    if (!lead.instagram && found.instagram) filled.instagram = contacts.instagram = found.instagram;
    if (!lead.facebook && found.facebook) filled.facebook = found.facebook;
    if (!lead.linkedin && found.linkedin) filled.linkedin = found.linkedin;
    if (!lead.tiktok && found.tiktok) filled.tiktok = found.tiktok;
    if (!lead.email && found.email) filled.email = found.email;
  }

  await db.lead.update({
    where: { id: lead.id },
    data: {
      ...filled,
      siteStatus,
      sitePlatform: platform,
      siteSignals: JSON.stringify(signals),
      enrichedAt: now,
      ...scoreColumns({
        source: lead.source,
        siteStatus,
        siteSignals: signals,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        whatsapp: contacts.whatsapp,
        instagram: contacts.instagram,
        businessStatus: lead.businessStatus,
      }),
    },
    select: { id: true },
  });
  return true;
}

/** Enriquece, com 5 sites em paralelo, os leads ainda não analisados. Devolve quantos foram analisados. */
export async function enrichLeads(leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  const pending = await db.lead.findMany({
    where: { id: { in: leadIds }, website: { not: null }, siteStatus: "UNKNOWN", enrichedAt: null },
    select: SELECT,
  });

  let enriched = 0;
  let next = 0;
  const worker = async () => {
    while (next < pending.length) {
      const lead = pending[next++];
      try {
        if (await enrichOne(lead)) enriched++;
      } catch (err) {
        // Falha em um site não pode derrubar a pesquisa.
        console.error(`[enrich] falha ao analisar o lead ${lead.id}:`, err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  return enriched;
}
