import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { userAgent } from "../config";

export const FETCH_TIMEOUT_MS = 8000;
export const MAX_BODY_BYTES = 1_500_000;
export const MAX_REDIRECTS = 3;

export type FetchSiteResult =
  | { kind: "ok"; finalUrl: string; html: string; lastModified: string | null }
  /** DNS falhou, tempo esgotado, 404, 5xx, IP bloqueado etc. */
  | { kind: "unreachable"; reason: string }
  /** Respondeu, mas não dá para analisar (403/429 por bot, não é HTML) */
  | { kind: "unknown"; reason: string };

// ---------- SSRF ----------

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 || // multicast e reservado
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** true para loopback, rede privada, link-local, multicast e qualquer coisa que não seja IP. */
export function isPrivateIp(rawIp: string): boolean {
  const ip = rawIp.split("%")[0].toLowerCase();
  const version = net.isIP(ip);
  if (version === 4) return isPrivateV4(ip);
  if (version !== 6) return true;

  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (dotted) return isPrivateV4(dotted[1]);
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isPrivateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (ip.startsWith("::")) return true; // :: e ::1
  const head = parseInt(ip.split(":")[0] || "0", 16);
  return (head & 0xfe00) === 0xfc00 || (head & 0xffc0) === 0xfe80 || (head & 0xff00) === 0xff00;
}

/** Valida o IP no momento da conexão, o que fecha a brecha de DNS rebinding. */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address, family);
    const list = Array.isArray(address) ? address.map((a) => a.address) : [address];
    if (list.some(isPrivateIp)) {
      const blocked: NodeJS.ErrnoException = new Error("Endereço bloqueado");
      blocked.code = "EBLOCKED";
      return callback(blocked, address, family);
    }
    callback(null, address, family);
  });
};

// ---------- Requisição ----------

interface RawResponse {
  status: number;
  contentType: string;
  location: string | null;
  lastModified: string | null;
  body: string;
}

function requestOnce(url: URL): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": userAgent(),
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers["content-type"] ?? ""),
            location: typeof res.headers.location === "string" ? res.headers.location : null,
            lastModified: typeof res.headers["last-modified"] === "string" ? res.headers["last-modified"] : null,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        };
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= MAX_BODY_BYTES) {
            finish();
            res.destroy(); // já lemos o suficiente
          }
        });
        res.on("end", finish);
        res.on("close", finish);
        res.on("error", (e) => (done ? undefined : reject(e)));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Uma requisição GET à página inicial, com proteções: só http/https, IP privado recusado,
 * até 3 redirecionamentos (cada destino é revalidado), tempo limite e tamanho máximo.
 */
export async function fetchSite(rawUrl: string): Promise<FetchSiteResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: "unreachable", reason: "URL inválida" };
  }

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "unreachable", reason: "Protocolo não permitido" };
      const literal = url.hostname.replace(/^\[|\]$/g, "");
      if (net.isIP(literal) && isPrivateIp(literal)) return { kind: "unreachable", reason: "Endereço bloqueado" };

      const res = await requestOnce(url);

      if ([301, 302, 303, 307, 308].includes(res.status) && res.location) {
        url = new URL(res.location, url);
        continue;
      }
      if (res.status === 404 || res.status === 410 || res.status >= 500) {
        return { kind: "unreachable", reason: `HTTP ${res.status}` };
      }
      if (res.status >= 400) return { kind: "unknown", reason: `HTTP ${res.status}` };
      if (res.status < 200 || res.status >= 300) return { kind: "unknown", reason: `HTTP ${res.status}` };
      if (res.contentType && !/html|xml|text\/plain/i.test(res.contentType)) {
        return { kind: "unknown", reason: "Conteúdo não é uma página HTML" };
      }
      return { kind: "ok", finalUrl: url.toString(), html: res.body, lastModified: res.lastModified };
    }
    return { kind: "unreachable", reason: "Redirecionamentos demais" };
  } catch (err) {
    return { kind: "unreachable", reason: err instanceof Error ? err.message : "Falha de rede" };
  }
}
