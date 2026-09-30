import { userAgent } from "../config";
import { socialUrl } from "../enrich/contacts";
import { digitsOnly, stateToUf, stripAccents } from "../leads/normalize";
import { cellSizeMeters } from "./grid";
import { createThrottle, fetchWithRetry } from "./http";
import { ProviderError, type Bounds, type CellQuery, type CellResult, type Provider, type RawPlace } from "./types";

// Instância oficial primeiro; espelhos públicos entram quando ela está sobrecarregada (504 é comum).
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
/** Acima deste lado (km) a área é dividida em 4 antes de consultar. */
export const OSM_MAX_CELL_KM = 50;

const throttle = createThrottle(2000);

export interface OsmTag {
  key: string;
  value: string;
}

const tag = (key: string, value: string): OsmTag => ({ key, value });

/** Categoria em português → tags OSM. Os apelidos são comparados sem acento e por "contém". */
const CATEGORY_TAGS: Array<{ aliases: string[]; tags: OsmTag[] }> = [
  { aliases: ["restaurante"], tags: [tag("amenity", "restaurant")] },
  { aliases: ["dentista", "odontolog"], tags: [tag("amenity", "dentist"), tag("healthcare", "dentist")] },
  { aliases: ["clinica", "consultorio"], tags: [tag("amenity", "clinic"), tag("amenity", "doctors"), tag("healthcare", "clinic")] },
  { aliases: ["academia"], tags: [tag("leisure", "fitness_centre")] },
  { aliases: ["advogado", "advocacia"], tags: [tag("office", "lawyer")] },
  { aliases: ["roupa", "moda", "boutique"], tags: [tag("shop", "clothes")] },
  { aliases: ["auto peca", "autopeca", "pecas automotivas"], tags: [tag("shop", "car_parts")] },
  { aliases: ["salao", "cabeleireiro", "estetica"], tags: [tag("shop", "hairdresser"), tag("shop", "beauty")] },
  { aliases: ["barbearia", "barbeiro"], tags: [tag("shop", "hairdresser")] },
  { aliases: ["padaria", "panificadora"], tags: [tag("shop", "bakery")] },
  { aliases: ["farmacia", "drogaria"], tags: [tag("amenity", "pharmacy")] },
  { aliases: ["pet shop", "petshop", "pet"], tags: [tag("shop", "pet")] },
  { aliases: ["oficina", "mecanica"], tags: [tag("shop", "car_repair")] },
  { aliases: ["hotel", "pousada"], tags: [tag("tourism", "hotel"), tag("tourism", "guest_house")] },
  { aliases: ["imobiliaria", "corretor"], tags: [tag("office", "estate_agent")] },
  { aliases: ["contabilidade", "contador"], tags: [tag("office", "accountant")] },
  { aliases: ["escola", "colegio"], tags: [tag("amenity", "school")] },
  { aliases: ["mercado", "supermercado", "mercearia"], tags: [tag("shop", "supermarket"), tag("shop", "convenience")] },
];

/** Devolve as tags OSM da categoria ou null quando não há correspondência. */
export function mapCategoryToOsm(category: string): OsmTag[] | null {
  const term = stripAccents(category.toLowerCase()).trim();
  if (!term) return null;
  const entry = CATEGORY_TAGS.find((e) => e.aliases.some((a) => term.includes(a)));
  return entry ? entry.tags : null;
}

const escapeQl = (s: string) => s.replace(/[\\"]/g, "\\$&");
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Consulta Overpass por caixa delimitadora. Pura. */
export function buildOverpassQuery(b: Bounds, category: string): string {
  const bbox = `(${b.south},${b.west},${b.north},${b.east})`;
  const tags = mapCategoryToOsm(category);
  const filters = tags
    ? tags.map((t) => `["${escapeQl(t.key)}"="${escapeQl(t.value)}"]`)
    : [`["name"~"${escapeQl(escapeRegex(category.trim()))}",i]`];
  const body = filters.map((f) => `  nwr${f}${bbox};`).join("\n");
  return `[out:json][timeout:90];\n(\n${body}\n);\nout center tags;`;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const first = (...values: Array<string | undefined>): string | null => {
  for (const v of values) {
    const item = v?.split(";")[0]?.trim();
    if (item) return item;
  }
  return null;
};

/** Mapeia um elemento do Overpass. Sem nome, descarta. Pura. */
export function mapOsmElement(el: OverpassElement, ctx: { category: string; city: string; state: string | null }): RawPlace | null {
  const t = el.tags ?? {};
  const name = t.name?.trim();
  if (!name) return null;

  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  // alguns registros trazem "Campinas/SP" no campo da cidade
  const city = t["addr:city"]?.trim().replace(/\s*[/-]\s*[A-Za-z]{2}$/, "") || ctx.city;
  const address = [street, t["addr:suburb"], city].filter(Boolean).join(" - ") || null;
  const whatsapp = first(t["contact:whatsapp"]);

  return {
    source: "osm",
    externalId: `${el.type}/${el.id}`,
    name,
    category: ctx.category,
    city,
    state: stateToUf(t["addr:state"]) ?? stateToUf(ctx.state),
    neighborhood: t["addr:suburb"]?.trim() || t["addr:neighbourhood"]?.trim() || null,
    address,
    postalCode: t["addr:postcode"]?.trim() || null,
    lat: el.lat ?? el.center?.lat ?? null,
    lng: el.lon ?? el.center?.lon ?? null,
    mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    businessStatus: null,
    website: first(t.website, t["contact:website"]),
    rating: null,
    reviewCount: null,
    openingHours: t.opening_hours?.trim() || null,
    whatsapp: whatsapp && digitsOnly(whatsapp) ? digitsOnly(whatsapp) : null,
    phone: first(t.phone, t["contact:phone"]),
    email: first(t.email, t["contact:email"]),
    facebook: socialUrl("facebook", t["contact:facebook"]),
    instagram: socialUrl("instagram", t["contact:instagram"]),
    ownerName: t.operator?.trim() || null,
  };
}

export const osmProvider: Provider = {
  source: "osm",

  async fetchCell({ cell, category, city, state }: CellQuery): Promise<CellResult> {
    const { height, width } = cellSizeMeters(cell);
    // Área grande demais: pede divisão sem consultar
    if (Math.max(height, width) / 1000 > OSM_MAX_CELL_KM) return { places: [], saturated: true, requests: 0 };

    await throttle();
    const body = new URLSearchParams({ data: buildOverpassQuery(cell, category) });
    let res: Response | null = null;
    let lastStatus = 0;
    let networkFailed = true;
    for (const url of OVERPASS_URLS) {
      try {
        const attempt = await fetchWithRetry(
          url,
          { method: "POST", headers: { "User-Agent": userAgent(), "Content-Type": "application/x-www-form-urlencoded" }, body },
          { attempts: 2, timeoutMs: 100_000, baseDelayMs: 3000 },
        );
        networkFailed = false;
        if (attempt.ok) {
          res = attempt;
          break;
        }
        lastStatus = attempt.status;
      } catch {
        /* tenta o próximo espelho */
      }
    }
    if (!res) {
      throw new ProviderError(
        networkFailed
          ? "Não consegui falar com o OpenStreetMap. Verifique a conexão com a internet."
          : `O OpenStreetMap está sobrecarregado ou indisponível (erro ${lastStatus}). Tente novamente em alguns minutos.`,
      );
    }
    const json = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
    if (!json.elements?.length && json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) {
      throw new ProviderError("O OpenStreetMap demorou demais para responder. Reduza o raio e tente de novo.");
    }

    const places: RawPlace[] = [];
    for (const el of json.elements ?? []) {
      const mapped = mapOsmElement(el, { category, city, state });
      if (mapped) places.push(mapped);
    }
    return { places, saturated: false, requests: 1 };
  },
};
