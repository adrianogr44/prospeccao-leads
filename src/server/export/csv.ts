import type { Cell } from "./rows";

const BOM = "﻿";
const SEPARATOR = ";";

/** Células de texto iniciadas por = + - @ (ou tab/CR) seriam executadas como fórmula: prefixa apóstrofo. */
export function guardFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function escapeCsvCell(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  const text = typeof cell === "number" ? String(cell) : guardFormula(cell);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV para o Excel brasileiro: BOM UTF-8, separador ";" e quebra de linha CRLF. */
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(SEPARATOR));
  return BOM + lines.join("\r\n") + "\r\n";
}
