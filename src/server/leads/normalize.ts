/** Limpeza e chaves de duplicidade. Funções puras. */
import type { LeadSource, SiteStatus } from "@/lib/contract";
import { parseSocialHref } from "../enrich/contacts";
import type { RawPlace } from "../providers/types";

export interface NormalizedPlace {
  source: LeadSource;
  externalId: string;
  dedupeKey: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  address: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  businessStatus: string | null;
  website: string | null;
  /** NONE, SOCIAL_ONLY ou UNKNOWN (tem site ainda não analisado) */
  siteStatus: SiteStatus;
  rating: number | null;
  reviewCount: number | null;
  openingHours: string | null;
  whatsapp: string | null;
  phone: string | null;
  phoneIsMobile: boolean;
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  tiktok: string | null;
  ownerName: string | null;
}

const STATES: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};
const UFS = new Set(Object.values(STATES));

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Nome comparável: minúsculas, sem acento, sem pontuação e sem sufixos societários. */
export function normalizeName(name: string): string {
  const base = stripAccents(name.toLowerCase()).replace(/\bs\/a\b/g, " ");
  return base
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !["ltda", "me", "eireli", "epp", "mei", "sa"].includes(t))
    .join(" ");
}

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Telefone brasileiro só com dígitos, sem código do país (55) nem zero de tronco. */
export function nationalPhoneDigits(phone: string): string {
  let d = digitsOnly(phone);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.startsWith("0") && d.length > 10) d = d.slice(1);
  return d;
}

/** Celular brasileiro: DDD + 9 dígitos começando em 9. */
export function isMobileBR(phone: string | null): boolean {
  if (!phone) return false;
  const d = nationalPhoneDigits(phone);
  return d.length === 11 && d[0] !== "0" && d[2] === "9";
}

/** A chave usa coordenada (e não telefone): mesmo nome a menos de ~110 m é o mesmo lugar. */
export function isCoordKey(key: string): boolean {
  return key.includes(",");
}

/** Metros entre duas coordenadas (equirretangular; o erro é desprezível nas distâncias daqui). */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const x = (bLng - aLng) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * R;
}

/** Até aqui, dois cadastros de mesmo nome são o mesmo lugar; duas filiais nunca ficam tão perto. */
export const SAME_PLACE_METERS = 150;

/**
 * Mesmo lugar cadastrado duas vezes na mesma fonte (no OpenStreetMap, o ponto e o
 * contorno do prédio): mesma chave e, quando há coordenada nos dois, a poucos metros.
 */
export function isSamePlace(
  a: { dedupeKey: string; lat: number | null; lng: number | null },
  b: { dedupeKey: string; lat: number | null; lng: number | null },
): boolean {
  if (a.dedupeKey !== b.dedupeKey) return false;
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return isCoordKey(a.dedupeKey);
  return distanceMeters(a.lat, a.lng, b.lat, b.lng) <= SAME_PLACE_METERS;
}

export function dedupeKey(name: string, phone: string | null, lat: number | null, lng: number | null): string {
  const n = normalizeName(name);
  const digits = phone ? nationalPhoneDigits(phone) : "";
  if (digits) return `${n}|${digits}`;
  if (lat !== null && lng !== null) return `${n}|${lat.toFixed(3)},${lng.toFixed(3)}`;
  return `${n}|`;
}

/** "Minas Gerais" / "mg" / "MG" → "MG". Valor desconhecido volta como veio (aparado). */
export function stateToUf(state: string | null | undefined): string | null {
  const value = state?.trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  if (UFS.has(upper)) return upper;
  return STATES[stripAccents(value.toLowerCase())] ?? value;
}

const clean = (s: string | null | undefined): string | null => {
  const v = s?.trim();
  return v ? v : null;
};

/** Aceita "www.site.com.br" sem esquema; só http/https; devolve null se inválida. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  const value = clean(raw);
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeWhatsapp(raw: string | null | undefined): string | null {
  const digits = raw ? digitsOnly(raw) : "";
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/**
 * Limpa uma empresa vinda da fonte. Se o "site" é só rede social/Linktree/WhatsApp,
 * o link vai para o campo da rede e `website` fica nulo (SOCIAL_ONLY).
 */
export function normalizePlace(raw: RawPlace): NormalizedPlace | null {
  const name = clean(raw.name);
  if (!name) return null;

  let website = normalizeUrl(raw.website);
  let instagram = clean(raw.instagram);
  let facebook = clean(raw.facebook);
  let whatsapp = normalizeWhatsapp(raw.whatsapp);
  let socialOnly = false;

  const social = website ? parseSocialHref(website) : null;
  if (social) {
    socialOnly = true;
    if (social.kind === "instagram") instagram ??= social.value;
    else if (social.kind === "facebook") facebook ??= social.value;
    else if (social.kind === "whatsapp") whatsapp ??= social.value;
    website = null;
  }

  const phone = clean(raw.phone);
  const siteStatus: SiteStatus = website ? "UNKNOWN" : socialOnly ? "SOCIAL_ONLY" : "NONE";

  return {
    source: raw.source,
    externalId: raw.externalId,
    dedupeKey: dedupeKey(name, phone, raw.lat, raw.lng),
    name,
    category: clean(raw.category),
    city: clean(raw.city),
    state: stateToUf(raw.state),
    neighborhood: clean(raw.neighborhood),
    address: clean(raw.address),
    postalCode: clean(raw.postalCode),
    lat: raw.lat,
    lng: raw.lng,
    mapsUrl: clean(raw.mapsUrl),
    businessStatus: clean(raw.businessStatus),
    website,
    siteStatus,
    rating: raw.rating,
    reviewCount: raw.reviewCount,
    openingHours: clean(raw.openingHours),
    whatsapp,
    phone,
    phoneIsMobile: isMobileBR(phone),
    email: clean(raw.email)?.toLowerCase() ?? null,
    facebook,
    instagram,
    linkedin: null,
    tiktok: null,
    ownerName: clean(raw.ownerName),
  };
}
