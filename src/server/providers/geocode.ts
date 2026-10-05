import { userAgent } from "../config";
import { createThrottle, fetchWithRetry } from "./http";
import { ProviderError } from "./types";

export interface GeoPoint {
  lat: number;
  lng: number;
  /** Nome oficial da cidade (com acento), para não gravar "Sao Paulo" e "São Paulo" como cidades diferentes. */
  cityName: string;
}

interface NominatimItem {
  lat: string;
  lon: string;
  name?: string;
}

// Nominatim permite 1 requisição por segundo.
const throttle = createThrottle(1100);
const cache = new Map<string, GeoPoint>();

async function lookup(query: string, fallbackName: string): Promise<GeoPoint | null> {
  await throttle();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  const res = await fetchWithRetry(
    url.toString(),
    { headers: { "User-Agent": userAgent(), "Accept-Language": "pt-BR" } },
    { timeoutMs: 15_000 },
  );
  if (!res.ok) throw new ProviderError("Não consegui localizar a cidade agora (serviço de mapas indisponível).");
  const items = (await res.json()) as NominatimItem[];
  const first = items[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, cityName: first.name?.trim() || fallbackName };
}

/** Centro da cidade. Tenta "cidade, UF, Brasil" e cai para "cidade, Brasil". */
export async function geocodeCity(city: string, state: string | null): Promise<GeoPoint> {
  const key = `${city}|${state ?? ""}`.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const queries = state ? [`${city}, ${state}, Brasil`, `${city}, Brasil`] : [`${city}, Brasil`];
  for (const q of queries) {
    const point = await lookup(q, city);
    if (point) {
      cache.set(key, point);
      return point;
    }
  }
  throw new ProviderError(`Não encontrei a cidade "${city}". Confira o nome e o estado.`);
}
