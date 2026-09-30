import type { LeadDTO, LeadFilters } from "@/lib/contract";
import { SITE_STATUS_LABEL } from "@/lib/contract";
import { db } from "../db";
import { LEAD_SELECT, toLeadDTO } from "../leads/dto";
import { buildLeadOrderBy, buildLeadWhere } from "../leads/query";
import { HttpError } from "../http";

export const EXPORT_ROW_LIMIT = 20_000;

export type Cell = string | number | null;

export interface ExportColumn {
  header: string;
  value: (lead: LeadDTO) => Cell;
}

const yesNo = (v: boolean) => (v ? "Sim" : "Não");
const SOURCE_LABEL = { google: "Google", osm: "OpenStreetMap" } as const;

/** Mesmas colunas em CSV, XLSX e Google Sheets. */
export const EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Nome", value: (l) => l.name },
  { header: "Categoria", value: (l) => l.category },
  { header: "Estrelas", value: (l) => l.stars },
  { header: "Score", value: (l) => l.score },
  { header: "Motivos do score", value: (l) => l.scoreReasons.join("; ") },
  { header: "Situação do site", value: (l) => SITE_STATUS_LABEL[l.siteStatus] },
  { header: "Site", value: (l) => l.website },
  { header: "Plataforma do site", value: (l) => l.sitePlatform },
  { header: "Sinais de site antigo", value: (l) => l.siteSignals.join("; ") },
  { header: "Telefone", value: (l) => l.phone },
  { header: "Telefone é celular", value: (l) => yesNo(l.phoneIsMobile) },
  { header: "WhatsApp", value: (l) => l.whatsapp },
  { header: "E-mail", value: (l) => l.email },
  { header: "Instagram", value: (l) => l.instagram },
  { header: "Facebook", value: (l) => l.facebook },
  { header: "LinkedIn", value: (l) => l.linkedin },
  { header: "TikTok", value: (l) => l.tiktok },
  { header: "Responsável", value: (l) => l.ownerName },
  { header: "Cidade", value: (l) => l.city },
  { header: "Estado", value: (l) => l.state },
  { header: "Bairro", value: (l) => l.neighborhood },
  { header: "Endereço", value: (l) => l.address },
  { header: "CEP", value: (l) => l.postalCode },
  { header: "Nota", value: (l) => l.rating },
  { header: "Avaliações", value: (l) => l.reviewCount },
  { header: "Horário de funcionamento", value: (l) => l.openingHours },
  { header: "Google Maps / mapa", value: (l) => l.mapsUrl },
  { header: "Situação da empresa", value: (l) => l.businessStatus },
  { header: "Fonte", value: (l) => SOURCE_LABEL[l.source] },
  { header: "Anotações", value: (l) => l.notes },
  { header: "Atualizado em", value: (l) => l.updatedAt },
];

export const EXPORT_HEADERS = EXPORT_COLUMNS.map((c) => c.header);

export function toExportRow(lead: LeadDTO): Cell[] {
  return EXPORT_COLUMNS.map((c) => c.value(lead));
}

/** Leads que atendem aos filtros, do melhor score para o pior. Recusa mais de 20 000 linhas. */
export async function fetchLeadsForExport(filters: LeadFilters): Promise<LeadDTO[]> {
  const rows = await db.lead.findMany({
    where: buildLeadWhere(filters),
    orderBy: buildLeadOrderBy({ sort: "score", dir: "desc" }),
    select: LEAD_SELECT,
    take: EXPORT_ROW_LIMIT + 1,
  });
  if (rows.length > EXPORT_ROW_LIMIT) {
    throw new HttpError(
      422,
      `A exportação passa de ${EXPORT_ROW_LIMIT.toLocaleString("pt-BR")} linhas. Aplique filtros para reduzir a lista.`,
    );
  }
  return rows.map(toLeadDTO);
}
