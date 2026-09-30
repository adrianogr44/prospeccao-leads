/** Leitura centralizada de variáveis de ambiente (segredos só vêm do .env). */

export function googlePlacesKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key ? key : null;
}

export function contactEmail(): string {
  return process.env.CONTACT_EMAIL?.trim() || "contato@exemplo.com";
}

/** User-Agent identificado, exigido pelo Nominatim e educado com os sites analisados. */
export function userAgent(): string {
  return `ProspeccaoLeads/1.0 (+mailto:${contactEmail()})`;
}

export interface ServiceAccount {
  email: string;
  credentials: { client_email: string; private_key: string };
}

function parseServiceAccountJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // O carregador de .env expande "\n" em aspas duplas e quebra o JSON: reescapa e tenta de novo.
    return JSON.parse(raw.replace(/\r?\n/g, "\\n"));
  }
}

export function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const json = parseServiceAccountJson(raw) as { client_email?: unknown; private_key?: unknown };
    if (typeof json.client_email !== "string" || typeof json.private_key !== "string") return null;
    return {
      email: json.client_email,
      credentials: { client_email: json.client_email, private_key: json.private_key },
    };
  } catch {
    return null;
  }
}
