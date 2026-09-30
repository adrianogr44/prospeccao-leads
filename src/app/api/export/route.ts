import type { NextRequest } from "next/server";
import { exportQuerySchema } from "@/lib/contract";
import { toCsv } from "@/server/export/csv";
import { EXPORT_HEADERS, fetchLeadsForExport, toExportRow } from "@/server/export/rows";
import { toXlsx } from "@/server/export/xlsx";
import { handle, parseQuery } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);

function attachment(body: BodyInit, contentType: string, ext: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="leads-${today()}.${ext}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function GET(req: NextRequest) {
  return handle(async () => {
    const { format, ...filters } = parseQuery(req, exportQuerySchema);
    const leads = await fetchLeadsForExport(filters);

    if (format === "json") return attachment(JSON.stringify(leads, null, 2), "application/json; charset=utf-8", "json");

    const rows = leads.map(toExportRow);
    if (format === "csv") return attachment(toCsv(EXPORT_HEADERS, rows), "text/csv; charset=utf-8", "csv");

    const xlsx = await toXlsx(EXPORT_HEADERS, rows);
    return attachment(
      new Uint8Array(xlsx),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "xlsx",
    );
  });
}
