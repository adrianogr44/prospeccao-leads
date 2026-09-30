import { describe, expect, it } from "vitest";
import {
  boundsAround,
  canSplit,
  cellSizeMeters,
  MAX_DEPTH,
  parseCursor,
  progressFromCursor,
  serializeCursor,
  splitCell,
} from "./grid";
import type { Cell } from "./types";

const cell = (over: Partial<Cell> = {}): Cell => ({ south: -21.6, north: -21.5, west: -45.5, east: -45.4, depth: 0, ...over });

describe("boundsAround", () => {
  it("cria um quadrado de lado 2 x raio", () => {
    const b = boundsAround(-21.55, -45.43, 10);
    const { height, width } = cellSizeMeters(b);
    expect(height).toBeCloseTo(20_000, -2);
    expect(width).toBeCloseTo(20_000, -2);
    expect((b.north + b.south) / 2).toBeCloseTo(-21.55, 6);
    expect((b.east + b.west) / 2).toBeCloseTo(-45.43, 6);
  });
});

describe("splitCell / canSplit", () => {
  it("divide em 4 filhas que cobrem a célula, uma profundidade abaixo", () => {
    const parent = cell({ depth: 2 });
    const kids = splitCell(parent);
    expect(kids).toHaveLength(4);
    expect(kids.every((k) => k.depth === 3)).toBe(true);
    expect(Math.min(...kids.map((k) => k.south))).toBe(parent.south);
    expect(Math.max(...kids.map((k) => k.north))).toBe(parent.north);
    expect(Math.min(...kids.map((k) => k.west))).toBe(parent.west);
    expect(Math.max(...kids.map((k) => k.east))).toBe(parent.east);
    const midLat = (parent.south + parent.north) / 2;
    expect(kids.filter((k) => k.north === midLat)).toHaveLength(2);
  });

  it("não divide na profundidade máxima", () => {
    expect(canSplit(cell({ depth: MAX_DEPTH - 1 }))).toBe(true);
    expect(canSplit(cell({ depth: MAX_DEPTH }))).toBe(false);
  });

  it("não divide célula com lado menor que 300 m", () => {
    expect(canSplit(cell({ south: 0, north: 0.002, west: 0, east: 0.1 }))).toBe(false); // ~222 m de altura
    expect(canSplit(cell({ south: 0, north: 0.004, west: 0, east: 0.004 }))).toBe(true); // ~445 m
  });
});

describe("cursor", () => {
  it("serializa e lê de volta", () => {
    const cursor = { pending: [cell()], done: 3 };
    expect(parseCursor(serializeCursor(cursor))).toEqual(cursor);
  });

  it("cursor ausente, corrompido ou com formato errado vira null", () => {
    expect(parseCursor(null)).toBeNull();
    expect(parseCursor("{nao e json")).toBeNull();
    expect(parseCursor(JSON.stringify({ pending: [{ south: 1 }], done: 0 }))).toBeNull();
    expect(parseCursor(JSON.stringify({ pending: [], done: "x" }))).toBeNull();
  });

  it("progresso = concluídas / (concluídas + pendentes)", () => {
    expect(progressFromCursor(null)).toBe(0);
    expect(progressFromCursor({ pending: [cell(), cell(), cell()], done: 1 })).toBe(25);
    expect(progressFromCursor({ pending: [], done: 4 })).toBe(99);
  });
});
