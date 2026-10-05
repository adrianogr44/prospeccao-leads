/**
 * Estado retomável da importação de CNPJ. Funções puras (o cursor é gravado como JSON na
 * coluna `CnpjImport.cursor`, do mesmo jeito que o cursor da grade de pesquisa).
 */
import { CNPJ_DUMP_PARTS } from "@/lib/contract";

export interface ImportCursor {
  stage: "municipios" | "dump" | "enrich";
  /** Códigos de município da Receita resolvidos a partir dos nomes pedidos. */
  codes: string[];
  /** UFs das cidades pedidas; a tabela de municípios não tem UF, então a UF desempata homônimos. */
  ufs: string[];
  /** Cidades que não existem na tabela de municípios (viram aviso na tela). */
  unknownCities: string[];
  /** Partes de `Estabelecimentos*.zip` ainda não lidas. */
  pending: number[];
  /** Partes de `Empresas*.zip` ainda não lidas (sempre as 10 — veja `importRazaoSocial`). */
  pendingEmpresas: number[];
  /** Total de partes da etapa do dump, base do cálculo de progresso. */
  totalParts: number;
  /**
   * Último lead examinado no enriquecimento (chave de continuação, não deslocamento):
   * enriquecer tira o lead do filtro "sem telefone ou sem e-mail", então um `skip`
   * numérico pularia registros.
   */
  enrichAfterId: string | null;
}

export const ALL_PARTS: number[] = Array.from({ length: CNPJ_DUMP_PARTS }, (_, i) => i);

/** Partes de `Estabelecimentos*.zip` pedidas (ou todas as 10), sem repetição e em ordem. */
export function resolveParts(parts: number[] | undefined): number[] {
  if (!parts || parts.length === 0) return ALL_PARTS;
  return [...new Set(parts)].filter((p) => p >= 0 && p < CNPJ_DUMP_PARTS).sort((a, b) => a - b);
}

/**
 * Cursor de uma importação que ainda não começou.
 * `skipDump`: só cruza de novo, usando o que já está na tabela `Cnpj` (nada é baixado além
 * da tabela de municípios, que resolve os códigos das cidades).
 */
export function initialCursor(parts: number[], skipDump = false): ImportCursor {
  const pending = skipDump ? [] : parts;
  const pendingEmpresas = skipDump ? [] : ALL_PARTS;
  return {
    stage: "municipios",
    codes: [],
    ufs: [],
    unknownCities: [],
    pending,
    pendingEmpresas,
    totalParts: pending.length + pendingEmpresas.length,
    enrichAfterId: null,
  };
}

const STAGES = new Set<ImportCursor["stage"]>(["municipios", "dump", "enrich"]);
const numbers = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((v): v is number => typeof v === "number") : [];
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** Lê o cursor gravado; JSON inválido ou de formato antigo devolve null (recomeça do zero). */
export function parseCursor(raw: string | null): ImportCursor | null {
  if (!raw) return null;
  try {
    const json: unknown = JSON.parse(raw);
    if (typeof json !== "object" || json === null) return null;
    const c = json as Record<string, unknown>;
    if (typeof c.stage !== "string" || !STAGES.has(c.stage as ImportCursor["stage"])) return null;
    if (!Array.isArray(c.pending)) return null;

    const pending = numbers(c.pending);
    const pendingEmpresas = numbers(c.pendingEmpresas);
    return {
      stage: c.stage as ImportCursor["stage"],
      codes: strings(c.codes),
      ufs: strings(c.ufs),
      unknownCities: strings(c.unknownCities),
      pending,
      pendingEmpresas,
      totalParts: typeof c.totalParts === "number" ? c.totalParts : pending.length + pendingEmpresas.length,
      enrichAfterId: typeof c.enrichAfterId === "string" ? c.enrichAfterId : null,
    };
  } catch {
    return null;
  }
}

export const serializeCursor = (cursor: ImportCursor): string => JSON.stringify(cursor);

/** 0 a 100. Unidades: municípios (1) + uma por parte do dump + enriquecimento (1). */
export function progressFromCursor(cursor: ImportCursor | null): number {
  if (!cursor) return 0;
  const total = cursor.totalParts + 2;
  const remaining =
    (cursor.stage === "municipios" ? 1 : 0) + cursor.pending.length + cursor.pendingEmpresas.length + 1;
  return Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100)));
}
