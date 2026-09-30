import type { Bounds, Cell } from "./types";

/** Limites da grade adaptativa (ver docs/fullstack-architecture.md §4). */
export const MAX_DEPTH = 6;
export const MIN_CELL_METERS = 300;

const M_PER_DEG_LAT = 111_320;

/** Quadrado de lado 2 × raio em torno do centro. */
export function boundsAround(lat: number, lng: number, radiusKm: number): Bounds {
  const dLat = (radiusKm * 1000) / M_PER_DEG_LAT;
  const dLng = (radiusKm * 1000) / (M_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}

export function cellSizeMeters(b: Bounds): { height: number; width: number } {
  const midLat = (b.south + b.north) / 2;
  return {
    height: (b.north - b.south) * M_PER_DEG_LAT,
    width: (b.east - b.west) * M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180),
  };
}

/** Célula pode ser dividida: profundidade abaixo do máximo e lado menor de pelo menos 300 m. */
export function canSplit(cell: Cell): boolean {
  const { height, width } = cellSizeMeters(cell);
  return cell.depth < MAX_DEPTH && Math.min(height, width) >= MIN_CELL_METERS;
}

export function splitCell(cell: Cell): Cell[] {
  const midLat = (cell.south + cell.north) / 2;
  const midLng = (cell.west + cell.east) / 2;
  const depth = cell.depth + 1;
  return [
    { south: cell.south, north: midLat, west: cell.west, east: midLng, depth },
    { south: cell.south, north: midLat, west: midLng, east: cell.east, depth },
    { south: midLat, north: cell.north, west: cell.west, east: midLng, depth },
    { south: midLat, north: cell.north, west: midLng, east: cell.east, depth },
  ];
}

// ---------- Cursor da pesquisa (fila de células pendentes) ----------

export interface SearchCursor {
  pending: Cell[];
  /** Células já concluídas */
  done: number;
}

export function serializeCursor(cursor: SearchCursor): string {
  return JSON.stringify(cursor);
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isCell(v: unknown): v is Cell {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return isNum(c.south) && isNum(c.north) && isNum(c.west) && isNum(c.east) && isNum(c.depth);
}

/** Cursor corrompido ou ausente vira null (a pesquisa recomeça da área inicial). */
export function parseCursor(raw: string | null): SearchCursor | null {
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as { pending?: unknown; done?: unknown };
    if (!Array.isArray(json.pending) || !json.pending.every(isCell) || !isNum(json.done)) return null;
    return { pending: json.pending, done: json.done };
  } catch {
    return null;
  }
}

/** 0-100 a partir das células concluídas ÷ (concluídas + pendentes). */
export function progressFromCursor(cursor: SearchCursor | null): number {
  if (!cursor) return 0;
  const total = cursor.done + cursor.pending.length;
  if (total === 0) return 0;
  return Math.min(99, Math.round((cursor.done / total) * 100));
}
