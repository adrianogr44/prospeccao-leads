import type { ProviderChoice } from "@/lib/contract";
import { googlePlacesKey } from "../config";
import { googleProvider } from "./google";
import { osmProvider } from "./osm";
import { ProviderError, type Provider } from "./types";

/** auto = Google se houver chave, senão OpenStreetMap. */
export function resolveProvider(choice: ProviderChoice): Provider {
  const hasKey = googlePlacesKey() !== null;
  if (choice === "osm") return osmProvider;
  if (choice === "google") {
    if (!hasKey) {
      throw new ProviderError(
        "A fonte Google exige uma chave. Crie uma chave da Places API (New) no Google Cloud, coloque em GOOGLE_PLACES_API_KEY no arquivo .env e reinicie o sistema. Ou escolha a fonte OpenStreetMap.",
      );
    }
    return googleProvider;
  }
  return hasKey ? googleProvider : osmProvider;
}
