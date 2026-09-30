import ExcelJS from "exceljs";
import type { Cell } from "./rows";

const MIN_WIDTH = 10;
const MAX_WIDTH = 60;

export async function toXlsx(headers: string[], rows: Cell[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Leads", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.addRow(headers).font = { bold: true };
  // Strings entram como texto (nunca como fórmula), então "=..." não executa.
  for (const row of rows) sheet.addRow(row);

  sheet.columns.forEach((column, i) => {
    const longest = Math.max(headers[i].length, ...rows.map((r) => String(r[i] ?? "").length));
    column.width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, longest + 2));
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
