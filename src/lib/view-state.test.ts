import { describe, expect, it } from "vitest";
import {
  activeStage,
  baseFilters,
  LEAK_FILTERS,
  parseView,
  READY_FILTERS,
  viewToParams,
  withStage,
} from "./view-state";

const parse = (query: string) => parseView(new URLSearchParams(query));

describe("parseView", () => {
  it("abre na etapa Prontas para abordar quando a URL não tem etapa", () => {
    expect(parse("").filters).toEqual(READY_FILTERS);
    expect(parse("city=Campinas").filters).toEqual({ city: "Campinas", ...READY_FILTERS });
  });

  it("respeita todas=1 (sem etapa) e filtros de etapa explícitos", () => {
    expect(parse("todas=1").filters).toEqual({});
    expect(parse("contacted=yes").filters).toEqual({ contacted: "yes" });
    expect(parse("needsSite=yes&hasContact=no").filters).toEqual(LEAK_FILTERS);
  });

  it("ignora valores inválidos", () => {
    expect(parse("todas=1&needsSite=talvez&minStars=9&siteStatus=XYZ").filters).toEqual({});
  });
});

describe("viewToParams", () => {
  const view = parse("");

  it("omite a etapa padrão e grava todas=1 quando não há etapa", () => {
    expect(viewToParams(view).toString()).toBe("");
    expect(viewToParams({ ...view, filters: {} }).toString()).toBe("todas=1");
    expect(viewToParams({ ...view, filters: { city: "Campinas" } }).toString()).toBe("city=Campinas&todas=1");
  });

  it("faz ida e volta de qualquer etapa", () => {
    for (const stage of ["found", "needsSite", "reachable", "ready", "contacted"] as const) {
      const filters = withStage({ city: "Campinas" }, stage);
      const back = parseView(viewToParams({ ...view, filters }));
      expect(back.filters).toEqual(filters);
      expect(activeStage(back.filters)).toBe(stage);
    }
  });
});

describe("funil", () => {
  it("reconhece a etapa só quando os três filtros batem", () => {
    expect(activeStage(READY_FILTERS)).toBe("ready");
    expect(activeStage({})).toBe("found");
    expect(activeStage(LEAK_FILTERS)).toBeNull();
    expect(activeStage({ contacted: "yes" })).toBeNull();
  });

  it("troca a etapa sem mexer nos outros filtros", () => {
    const filters = { city: "Campinas", minStars: 4, ...READY_FILTERS };
    expect(withStage(filters, "contacted")).toEqual({ city: "Campinas", minStars: 4, needsSite: "yes", contacted: "yes" });
    expect(withStage(filters, "found")).toEqual({ city: "Campinas", minStars: 4 });
    expect(baseFilters(filters)).toEqual({ city: "Campinas", minStars: 4 });
  });
});
