import { googlePlacesKey } from "../config";
import { fetchWithRetry } from "./http";
import { ProviderError, type CellQuery, type CellResult, type Provider, type RawPlace } from "./types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const PAGE_SIZE = 20;
const MAX_PAGES = 3; // limite da API: 60 resultados por consulta
export const GOOGLE_RESULT_LIMIT = PAGE_SIZE * MAX_PAGES;

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "nextPageToken",
].join(",");

interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  primaryTypeDisplayName?: { text?: string };
  businessStatus?: string;
}

function component(list: AddressComponent[], types: string[], field: "longText" | "shortText" = "longText"): string | null {
  for (const type of types) {
    const found = list.find((c) => c.types?.includes(type));
    if (found?.[field]) return found[field] ?? null;
  }
  return null;
}

/** Mapeia um lugar da Places API (New) para os campos comuns. Pura. */
export function mapGooglePlace(p: GooglePlace): RawPlace | null {
  const name = p.displayName?.text;
  if (!p.id || !name) return null;
  const comps = p.addressComponents ?? [];
  return {
    source: "google",
    externalId: p.id,
    name,
    category: p.primaryTypeDisplayName?.text ?? null,
    city: component(comps, ["administrative_area_level_2", "locality"]),
    state: component(comps, ["administrative_area_level_1"], "shortText"),
    neighborhood: component(comps, ["sublocality_level_1", "sublocality", "neighborhood"]),
    address: p.formattedAddress ?? null,
    postalCode: component(comps, ["postal_code"]),
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    mapsUrl: p.googleMapsUri ?? null,
    businessStatus: p.businessStatus ?? null,
    website: p.websiteUri ?? null,
    rating: p.rating ?? null,
    // O Google omite a contagem quando não há avaliações
    reviewCount: p.userRatingCount ?? 0,
    openingHours: p.regularOpeningHours?.weekdayDescriptions?.join(" | ") ?? null,
    whatsapp: null, // nunca inferido
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    email: null,
    facebook: null,
    instagram: null,
    ownerName: null,
  };
}

async function googleError(res: Response): Promise<ProviderError> {
  let detail = "";
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    detail = json.error?.message ?? "";
  } catch {
    /* corpo não é JSON */
  }
  if (res.status === 429) {
    return new ProviderError("O limite de consultas do Google foi atingido. Tente mais tarde ou reduza o tamanho da pesquisa.");
  }
  if (res.status === 400 && /api key/i.test(detail)) {
    return new ProviderError("A chave do Google (GOOGLE_PLACES_API_KEY) é inválida. Confira o valor no arquivo .env.");
  }
  if (res.status === 400 || res.status === 403) {
    return new ProviderError(
      "O Google recusou a consulta. Confira se a chave está correta, se a Places API (New) está ativada e se a cobrança está habilitada no Google Cloud.",
    );
  }
  return new ProviderError(`O Google está indisponível no momento (erro ${res.status}). Tente novamente mais tarde.`);
}

export const googleProvider: Provider = {
  source: "google",

  async fetchCell({ cell, category, keywords }: CellQuery): Promise<CellResult> {
    const key = googlePlacesKey();
    if (!key) throw new ProviderError("Chave do Google não configurada.");

    const textQuery = [category, keywords].filter(Boolean).join(" ");
    const places: RawPlace[] = [];
    let requests = 0;
    let pageToken: string | undefined;
    let hasMore = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      const body = {
        textQuery,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: PAGE_SIZE,
        locationRestriction: {
          rectangle: {
            low: { latitude: cell.south, longitude: cell.west },
            high: { latitude: cell.north, longitude: cell.east },
          },
        },
        ...(pageToken ? { pageToken } : {}),
      };
      let res: Response;
      try {
        res = await fetchWithRetry(
          ENDPOINT,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
            body: JSON.stringify(body),
          },
          { timeoutMs: 20_000 },
        );
      } catch {
        throw new ProviderError("Não consegui falar com o Google. Verifique a conexão com a internet.");
      }
      requests++;
      if (!res.ok) throw await googleError(res);

      const json = (await res.json()) as { places?: GooglePlace[]; nextPageToken?: string };
      for (const p of json.places ?? []) {
        const mapped = mapGooglePlace(p);
        if (mapped) places.push(mapped);
      }
      pageToken = json.nextPageToken;
      if (!pageToken) break;
      hasMore = page === MAX_PAGES - 1;
    }

    return { places, saturated: hasMore || places.length >= GOOGLE_RESULT_LIMIT, requests };
  },
};
