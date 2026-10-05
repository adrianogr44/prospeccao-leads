/**
 * Acesso aos arquivos dos Dados Abertos de CNPJ.
 *
 * Em 05/10/2026 o diretório oficial é um compartilhamento Nextcloud em
 * `https://arquivos.receitafederal.gov.br/index.php/s/YggdBLfdninEJX9`. A página exige
 * JavaScript, mas o mesmo acervo sai pelo WebDAV do compartilhamento, com o token do link
 * como usuário do HTTP Basic e senha vazia:
 *
 *   GET https://arquivos.receitafederal.gov.br/public.php/webdav/2026-09/Estabelecimentos0.zip
 *
 * Os endereços antigos (`dadosabertos.rfb.gov.br/CNPJ/...` e `200.152.38.155/CNPJ/...`) não
 * respondem mais; por isso base e token vivem em `server/config.ts` e podem vir do `.env`.
 */
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { cnpjBaseUrl, cnpjShareToken, userAgent } from "../config";

/** Erro com mensagem pronta para o usuário (mesmo papel do `ProviderError` da coleta). */
export class CnpjSourceError extends Error {}

export const ESTABELECIMENTO_PARTS = 10;
export const EMPRESA_PARTS = 10;

export const MUNICIPIOS_FILE = "Municipios.zip";
export const estabelecimentoFile = (part: number) => `Estabelecimentos${part}.zip`;
export const empresaFile = (part: number) => `Empresas${part}.zip`;

/** Mês do dump no formato AAAA-MM. */
export function fileUrl(month: string, file: string): string {
  return `${cnpjBaseUrl()}/${month}/${file}`;
}

function authHeaders(): HeadersInit {
  // Token como usuário e senha vazia: é como o Nextcloud autentica um link público.
  const basic = Buffer.from(`${cnpjShareToken()}:`).toString("base64");
  return { Authorization: `Basic ${basic}`, "User-Agent": userAgent() };
}

const MINUTE = 60_000;
/** Arquivos pequenos (tabelas de domínio). */
const SMALL_TIMEOUT_MS = 2 * MINUTE;
/** Estabelecimentos0.zip tem 2,2 GB: o limite protege contra socket travado, não contra demora. */
const LARGE_TIMEOUT_MS = 180 * MINUTE;

export function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  return year && m ? `${m}/${year}` : month;
}

/** `true` se o arquivo existe no mês (HEAD 200). */
export async function fileExists(month: string, file: string): Promise<boolean> {
  try {
    const res = await fetch(fileUrl(month, file), {
      method: "HEAD",
      headers: authHeaders(),
      signal: AbortSignal.timeout(SMALL_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** AAAA-MM de uma data. */
export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** AAAA-MM `back` meses antes de `date`. */
export function monthBefore(date: Date, back: number): string {
  return monthOf(new Date(date.getFullYear(), date.getMonth() - back, 1));
}

/**
 * Mês mais recente publicado. A listagem do diretório exige WebDAV PROPFIND, então o
 * caminho curto é tentar `Municipios.zip` do mês atual para trás (o dump sai uma vez por mês).
 */
export async function latestMonth(now = new Date(), lookBack = 12): Promise<string> {
  for (let back = 0; back <= lookBack; back++) {
    const month = monthBefore(now, back);
    if (await fileExists(month, MUNICIPIOS_FILE)) return month;
  }
  throw new CnpjSourceError(
    "Não encontrei nenhum dump de CNPJ nos últimos 12 meses no endereço da Receita. Confira a conexão ou atualize RECEITA_CNPJ_BASE_URL no .env.",
  );
}

/**
 * Abre o download de um arquivo do dump como fluxo Node, sem carregar nada na memória.
 * `large` só afeta o limite de tempo.
 */
export async function openFile(month: string, file: string, large = false): Promise<Readable> {
  const url = fileUrl(month, file);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(large ? LARGE_TIMEOUT_MS : SMALL_TIMEOUT_MS),
    });
  } catch (err) {
    throw new CnpjSourceError(
      `Não consegui baixar ${file} do dump de ${monthLabel(month)}: ${err instanceof Error ? err.message : "falha de rede"}.`,
    );
  }
  if (!res.ok || !res.body) {
    await res.body?.cancel();
    const detail =
      res.status === 404
        ? "o arquivo não existe nesse mês"
        : res.status === 401
          ? "o token do compartilhamento foi recusado (atualize RECEITA_CNPJ_TOKEN no .env)"
          : `o servidor respondeu ${res.status}`;
    throw new CnpjSourceError(`Não consegui baixar ${file} do dump de ${monthLabel(month)}: ${detail}.`);
  }
  // `res.body` é o ReadableStream do DOM; `fromWeb` espera o de `node:stream/web`. Mesmo objeto,
  // declarações diferentes nas bibliotecas de tipos.
  return Readable.fromWeb(res.body as NodeReadableStream<Uint8Array>);
}
