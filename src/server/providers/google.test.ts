import { describe, expect, it } from "vitest";
import { mapGooglePlace, type GooglePlace } from "./google";

const place: GooglePlace = {
  id: "ChIJabc",
  displayName: { text: "Clínica Sorriso" },
  formattedAddress: "Rua X, 100 - Centro, Varginha - MG, 37000-000",
  addressComponents: [
    { longText: "100", shortText: "100", types: ["street_number"] },
    { longText: "Centro", shortText: "Centro", types: ["sublocality_level_1", "sublocality"] },
    { longText: "Varginha", shortText: "Varginha", types: ["administrative_area_level_2", "political"] },
    { longText: "Minas Gerais", shortText: "MG", types: ["administrative_area_level_1", "political"] },
    { longText: "37000-000", shortText: "37000-000", types: ["postal_code"] },
  ],
  location: { latitude: -21.55, longitude: -45.43 },
  primaryTypeDisplayName: { text: "Dentista" },
  nationalPhoneNumber: "(35) 3221-1234",
  regularOpeningHours: { weekdayDescriptions: ["segunda: 08:00-18:00", "terça: 08:00-18:00"] },
};

describe("mapGooglePlace", () => {
  it("extrai cidade, UF (2 letras), bairro e CEP dos componentes de endereço", () => {
    expect(mapGooglePlace(place)).toMatchObject({
      source: "google",
      externalId: "ChIJabc",
      name: "Clínica Sorriso",
      category: "Dentista",
      city: "Varginha",
      state: "MG",
      neighborhood: "Centro",
      postalCode: "37000-000",
      phone: "(35) 3221-1234",
      whatsapp: null,
      website: null,
      reviewCount: 0,
      openingHours: "segunda: 08:00-18:00 | terça: 08:00-18:00",
    });
  });

  it("descarta lugar sem id ou nome", () => {
    expect(mapGooglePlace({ id: "x" })).toBeNull();
  });
});
