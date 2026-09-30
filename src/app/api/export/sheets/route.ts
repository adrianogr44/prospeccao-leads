import type { NextRequest } from "next/server";
import { sheetsExportSchema } from "@/lib/contract";
import { serviceAccount } from "@/server/config";
import { EXPORT_HEADERS, fetchLeadsForExport, toExportRow } from "@/server/export/rows";
import { exportToSheets, SETUP_HELP } from "@/server/export/sheets";
import { handle, HttpError, parseBody } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return handle(async () => {
    const { spreadsheet, filters } = await parseBody(req, sheetsExportSchema);
    // Falha cedo, antes de ler milhares de linhas do banco.
    if (!serviceAccount()) throw new HttpError(400, SETUP_HELP);
    const leads = await fetchLeadsForExport(filters);
    return Response.json(await exportToSheets(spreadsheet, EXPORT_HEADERS, leads.map(toExportRow)));
  });
}
