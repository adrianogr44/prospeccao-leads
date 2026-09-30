import { describe, expect, it } from "vitest";
import { normalizePlace } from "../leads/normalize";
import { geocodeCity } from "./geocode";
import { boundsAround } from "./grid";
import { buildOverpassQuery, mapCategoryToOsm, mapOsmElement, osmProvider } from "./osm";

describe("mapCategoryToOsm", () => {
  it("mapeia categorias em português", () => {
    expect(mapCategoryToOsm("Restaurante")).toEqual([{ key: "amenity", value: "restaurant" }]);
    expect(mapCategoryToOsm("restaurantes")).toEqual([{ key: "amenity", value: "restaurant" }]);
    expect(mapCategoryToOsm("Farmácia")).toEqual([{ key: "amenity", value: "pharmacy" }]);
    expect(mapCategoryToOsm("loja de roupas")).toEqual([{ key: "shop", value: "clothes" }]);
    expect(mapCategoryToOsm("Auto peças")).toEqual([{ key: "shop", value: "car_parts" }]);
    expect(mapCategoryToOsm("Salão de beleza")).toContainEqual({ key: "shop", value: "hairdresser" });
  });

  it("devolve null quando não conhece", () => {
    expect(mapCategoryToOsm("xpto galáctico")).toBeNull();
    expect(mapCategoryToOsm("  ")).toBeNull();
  });
});

describe("buildOverpassQuery", () => {
  const b = { south: 1, west: 2, north: 3, east: 4, depth: 0 };

  it("usa as tags OSM quando a categoria é conhecida", () => {
    const q = buildOverpassQuery(b, "restaurante");
    expect(q).toContain('nwr["amenity"="restaurant"](1,2,3,4);');
    expect(q).toContain("out center tags;");
  });

  it("cai para busca por nome, escapando o termo", () => {
    const q = buildOverpassQuery(b, 'xpto (a"b)');
    // A barra da regex (\() é escapada de novo para a string do Overpass QL (\\()
    expect(q).toContain('nwr["name"~"xpto \\\\(a\\"b\\\\)",i](1,2,3,4);');
  });
});

describe("mapOsmElement", () => {
  const ctx = { category: "restaurante", city: "Varginha", state: "Minas Gerais" };

  it("usa a cidade e a UF da pesquisa quando o OSM não informa", () => {
    const p = mapOsmElement(
      { type: "node", id: 7, lat: -21.55, lon: -45.43, tags: { name: "Cantina Bella", phone: "+55 35 3221-1234; +55 35 3221-0000" } },
      ctx,
    );
    expect(p).toMatchObject({
      source: "osm",
      externalId: "node/7",
      city: "Varginha",
      state: "MG",
      category: "restaurante",
      phone: "+55 35 3221-1234",
      rating: null,
      reviewCount: null,
      whatsapp: null,
    });
  });

  it("lê endereço, contatos e operador; way usa o centro", () => {
    const p = mapOsmElement(
      {
        type: "way",
        id: 9,
        center: { lat: 1, lon: 2 },
        tags: {
          name: "Bar",
          "addr:street": "Rua A",
          "addr:housenumber": "10",
          "addr:suburb": "Centro",
          "addr:city": "Três Corações",
          "addr:state": "MG",
          "addr:postcode": "37410-000",
          "contact:whatsapp": "+55 35 99999-8888",
          "contact:instagram": "@bar_do_ze",
          website: "bar.com.br",
          operator: "José",
        },
      },
      ctx,
    );
    expect(p).toMatchObject({
      city: "Três Corações",
      state: "MG",
      neighborhood: "Centro",
      postalCode: "37410-000",
      lat: 1,
      lng: 2,
      whatsapp: "5535999998888",
      instagram: "https://www.instagram.com/bar_do_ze",
      website: "bar.com.br",
      ownerName: "José",
    });
    expect(p?.address).toBe("Rua A, 10 - Centro - Três Corações");
  });

  it("descarta elemento sem nome", () => {
    expect(mapOsmElement({ type: "node", id: 1, lat: 0, lon: 0, tags: { amenity: "restaurant" } }, ctx)).toBeNull();
  });
});

// Teste real contra Nominatim + Overpass. Rode com: LIVE=1 npx vitest run osm.test
describe.skipIf(!process.env.LIVE)("OSM ao vivo (Varginha, MG)", () => {
  it("geocodifica e busca restaurantes em 3 km", async () => {
    const center = await geocodeCity("Varginha", "MG");
    expect(center.lat).toBeLessThan(-21);
    expect(center.lat).toBeGreaterThan(-22);

    const cell = { ...boundsAround(center.lat, center.lng, 3), depth: 0 };
    const result = await osmProvider.fetchCell({ cell, category: "restaurante", keywords: null, city: "Varginha", state: "MG" });
    const normalized = result.places.flatMap((r) => normalizePlace(r) ?? []);
    console.log(`[LIVE] centro=${center.lat},${center.lng} brutos=${result.places.length} normalizados=${normalized.length} requests=${result.requests}`);
    console.log("[LIVE] exemplo:", JSON.stringify(normalized[0]));

    expect(result.requests).toBe(1);
    expect(normalized.length).toBeGreaterThan(0);
    expect(normalized[0]).toMatchObject({ source: "osm", city: expect.any(String), state: "MG" });
    expect(normalized.every((p) => p.name && p.externalId.includes("/") && p.dedupeKey.includes("|"))).toBe(true);
  }, 180_000);
});
