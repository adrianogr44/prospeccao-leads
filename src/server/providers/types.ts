import type { LeadSource } from "@/lib/contract";

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Célula da grade adaptativa; `depth` conta quantas divisões vieram da área inicial. */
export interface Cell extends Bounds {
  depth: number;
}

/** Empresa como veio da fonte, já mapeada para campos comuns (antes da limpeza). */
export interface RawPlace {
  source: LeadSource;
  externalId: string;
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
  rating: number | null;
  reviewCount: number | null;
  openingHours: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  facebook: string | null;
  instagram: string | null;
  ownerName: string | null;
}

export interface CellQuery {
  cell: Cell;
  category: string;
  keywords: string | null;
  /** Cidade e UF da pesquisa: usadas como padrão quando a fonte não informa endereço */
  city: string;
  state: string | null;
}

export interface CellResult {
  places: RawPlace[];
  /** A célula atingiu o limite da fonte e deve ser dividida em 4 */
  saturated: boolean;
  /** Chamadas HTTP feitas à fonte (para acompanhar custo) */
  requests: number;
}

export interface Provider {
  source: LeadSource;
  fetchCell(query: CellQuery): Promise<CellResult>;
}

/** Erro com mensagem em português para o usuário leigo; `fatal` interrompe a pesquisa. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly fatal = true,
  ) {
    super(message);
  }
}
