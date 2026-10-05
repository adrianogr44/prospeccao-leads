import type { Prisma } from "@prisma/client";
import type { CnpjImportDTO, CnpjImportInput, CnpjImportStatus } from "@/lib/contract";
import { cnpjImportInputSchema } from "@/lib/contract";
import { parseCursor, progressFromCursor, resolveParts } from "./cursor";

export const IMPORT_SELECT = {
  id: true,
  dumpMonth: true,
  cities: true,
  status: true,
  error: true,
  cursor: true,
  savedCount: true,
  scannedCount: true,
  examinedCount: true,
  matchedCount: true,
  phoneCount: true,
  emailCount: true,
  ambiguousCount: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
} satisfies Prisma.CnpjImportSelect;

export type ImportRow = Prisma.CnpjImportGetPayload<{ select: typeof IMPORT_SELECT }>;

/** Lê o pedido guardado na coluna `cities` (JSON com cidades e partes). */
export function parseImportInput(raw: string): CnpjImportInput {
  try {
    const parsed = cnpjImportInputSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // JSON corrompido: cai no pedido vazio abaixo
  }
  return { cities: [], skipDump: false };
}

export const serializeImportInput = (input: CnpjImportInput): string => JSON.stringify(input);

export function toCnpjImportDTO(row: ImportRow): CnpjImportDTO {
  const input = parseImportInput(row.cities);
  const cursor = parseCursor(row.cursor);
  const status = row.status as CnpjImportStatus;
  return {
    id: row.id,
    dumpMonth: row.dumpMonth,
    cities: input.cities,
    parts: resolveParts(input.parts),
    status,
    stage: cursor?.stage ?? null,
    error: row.error,
    unknownCities: cursor?.unknownCities ?? [],
    progress: status === "done" ? 100 : progressFromCursor(cursor),
    scannedCount: row.scannedCount,
    savedCount: row.savedCount,
    examinedCount: row.examinedCount,
    matchedCount: row.matchedCount,
    phoneCount: row.phoneCount,
    emailCount: row.emailCount,
    ambiguousCount: row.ambiguousCount,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}
