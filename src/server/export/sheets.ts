import { GoogleAuth } from "google-auth-library";
import type { SheetsExportResponse } from "@/lib/contract";
import { serviceAccount } from "../config";
import { HttpError } from "../http";
import type { Cell } from "./rows";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const API = "https://sheets.googleapis.com/v4/spreadsheets";
const CHUNK_ROWS = 2000;

export const SETUP_HELP =
  "A exportação para o Google Sheets não está configurada. Crie uma conta de serviço no Google Cloud, ative a Google Sheets API, coloque o JSON em uma linha em GOOGLE_SERVICE_ACCOUNT_JSON no arquivo .env, reinicie o sistema e compartilhe a planilha com o e-mail da conta de serviço (como Editor).";

/** Aceita o ID puro ou a URL completa da planilha. */
export function parseSpreadsheetId(input: string): string | null {
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(input);
  const id = fromUrl ? fromUrl[1] : input.trim();
  return /^[a-zA-Z0-9_-]{10,}$/.test(id) ? id : null;
}

export function sheetTitle(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `Leads ${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}${p(now.getMinutes())}`;
}

interface GoogleApiError {
  response?: { status?: number };
}

function translate(err: unknown, email: string): HttpError {
  const status = (err as GoogleApiError).response?.status;
  if (status === 403) {
    return new HttpError(400, `Sem permissão na planilha. Compartilhe-a como Editor com ${email}.`);
  }
  if (status === 404) return new HttpError(400, "Planilha não encontrada. Confira o link ou o ID.");
  console.error("[sheets] falha na API do Google Sheets:", err);
  return new HttpError(502, "O Google Sheets recusou ou não respondeu à exportação. Tente novamente.");
}

export async function exportToSheets(spreadsheet: string, headers: string[], rows: Cell[][]): Promise<SheetsExportResponse> {
  const account = serviceAccount();
  if (!account) throw new HttpError(400, SETUP_HELP);
  const spreadsheetId = parseSpreadsheetId(spreadsheet);
  if (!spreadsheetId) throw new HttpError(400, "Link ou ID de planilha inválido.");

  const auth = new GoogleAuth({ credentials: account.credentials, scopes: [SCOPE] });
  const client = await auth.getClient();
  const title = sheetTitle();

  try {
    const added = await client.request<{ replies: Array<{ addSheet: { properties: { sheetId: number } } }> }>({
      url: `${API}/${spreadsheetId}:batchUpdate`,
      method: "POST",
      data: {
        requests: [
          {
            addSheet: {
              properties: { title, gridProperties: { rowCount: rows.length + 1, columnCount: headers.length, frozenRowCount: 1 } },
            },
          },
        ],
      },
    });
    const sheetId = added.data.replies[0].addSheet.properties.sheetId;

    const values = [headers, ...rows.map((r) => r.map((c) => c ?? ""))];
    const quoted = `'${title.replace(/'/g, "''")}'`;
    for (let start = 0; start < values.length; start += CHUNK_ROWS) {
      await client.request({
        url: `${API}/${spreadsheetId}/values/${encodeURIComponent(`${quoted}!A${start + 1}`)}?valueInputOption=RAW`,
        method: "PUT",
        data: { values: values.slice(start, start + CHUNK_ROWS) },
      });
    }

    return { url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`, rows: rows.length, sheetTitle: title };
  } catch (err) {
    throw translate(err, account.email);
  }
}
