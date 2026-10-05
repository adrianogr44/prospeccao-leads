import { describe, expect, it } from "vitest";
import {
  ALL_PARTS,
  initialCursor,
  parseCursor,
  progressFromCursor,
  resolveParts,
  serializeCursor,
  type ImportCursor,
} from "./cursor";

describe("resolveParts", () => {
  it("sem pedido usa as 10 partes", () => {
    expect(resolveParts(undefined)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(resolveParts([])).toEqual(ALL_PARTS);
  });

  it("ordena, tira repetição e descarta fora da faixa", () => {
    expect(resolveParts([3, 1, 3])).toEqual([1, 3]);
    expect(resolveParts([-1, 10, 2])).toEqual([2]);
  });
});

describe("parseCursor e serializeCursor", () => {
  it("vai e volta sem perder nada", () => {
    const cursor = initialCursor([1]);
    expect(parseCursor(serializeCursor(cursor))).toEqual(cursor);
  });

  it("só cruzar de novo não deixa nenhuma parte do dump pendente", () => {
    const cursor = initialCursor([1], true);
    expect(cursor.pending).toEqual([]);
    expect(cursor.pendingEmpresas).toEqual([]);
    expect(cursor.totalParts).toBe(0);
  });

  it("recusa JSON inválido, etapa desconhecida e formato antigo", () => {
    expect(parseCursor(null)).toBeNull();
    expect(parseCursor("{{")).toBeNull();
    expect(parseCursor("[]")).toBeNull();
    expect(parseCursor('{"stage":"outra","pending":[]}')).toBeNull();
    expect(parseCursor('{"stage":"dump"}')).toBeNull();
  });

  it("completa o que falta em um cursor antigo, sem partes de Empresas", () => {
    const cursor = parseCursor('{"stage":"dump","codes":["6291"],"pending":[2,3]}');
    expect(cursor).toEqual({
      stage: "dump",
      codes: ["6291"],
      ufs: [],
      unknownCities: [],
      pending: [2, 3],
      pendingEmpresas: [],
      totalParts: 2,
      enrichAfterId: null,
    });
  });
});

describe("progressFromCursor", () => {
  const dump = (over: Partial<ImportCursor> = {}): ImportCursor => ({ ...initialCursor([1]), stage: "dump", ...over });

  it("sem cursor é zero", () => {
    expect(progressFromCursor(null)).toBe(0);
  });

  it("cresce conforme as partes terminam e chega a 100 no fim do enriquecimento", () => {
    // 1 parte de estabelecimentos + 10 de empresas + municípios + enriquecimento = 13 unidades
    expect(progressFromCursor(initialCursor([1]))).toBe(0);
    const comecou = progressFromCursor(dump());
    expect(comecou).toBeGreaterThan(0);
    expect(progressFromCursor(dump({ pending: [] }))).toBeGreaterThan(comecou);
    expect(progressFromCursor(dump({ pending: [], pendingEmpresas: [] }))).toBeGreaterThan(50);
    expect(progressFromCursor(dump({ stage: "enrich", pending: [], pendingEmpresas: [] }))).toBe(92);
  });

  it("fica entre 0 e 100 mesmo com cursor estranho", () => {
    // Mais partes pendentes do que o total declarado não devolve negativo.
    expect(progressFromCursor(dump({ totalParts: 1, pending: [1, 2, 3], pendingEmpresas: [] }))).toBe(0);
    for (const over of [{ totalParts: 0 }, { totalParts: 99 }, { enrichAfterId: "abc" }]) {
      const value = progressFromCursor(dump({ pending: [], pendingEmpresas: [], ...over }));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});
