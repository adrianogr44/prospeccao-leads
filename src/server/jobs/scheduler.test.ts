import { describe, expect, it } from "vitest";
import { firstRunAt, nextRunAfter } from "./scheduler";

describe("firstRunAt", () => {
  it("hoje, se a hora ainda não passou", () => {
    expect(firstRunAt(18, new Date(2026, 8, 30, 15, 0))).toEqual(new Date(2026, 8, 30, 18, 0));
  });

  it("amanhã, se já passou ou é exatamente agora", () => {
    expect(firstRunAt(3, new Date(2026, 8, 30, 15, 0))).toEqual(new Date(2026, 9, 1, 3, 0));
    expect(firstRunAt(3, new Date(2026, 8, 30, 3, 0))).toEqual(new Date(2026, 9, 1, 3, 0));
  });

  it("vira o mês", () => {
    expect(firstRunAt(3, new Date(2026, 11, 31, 10, 0))).toEqual(new Date(2027, 0, 1, 3, 0));
  });
});

describe("nextRunAfter", () => {
  const ran = new Date(2026, 8, 30, 3, 0, 5);

  it("diário: próxima ocorrência da hora", () => {
    expect(nextRunAfter("daily", 3, ran)).toEqual(new Date(2026, 9, 1, 3, 0));
  });

  it("semanal: 7 dias depois, na hora", () => {
    expect(nextRunAfter("weekly", 3, ran)).toEqual(new Date(2026, 9, 7, 3, 0));
  });

  it("mensal: mesmo dia do mês seguinte, com ajuste para meses curtos", () => {
    expect(nextRunAfter("monthly", 3, ran)).toEqual(new Date(2026, 9, 30, 3, 0));
    expect(nextRunAfter("monthly", 3, new Date(2026, 0, 31, 3, 0))).toEqual(new Date(2026, 1, 28, 3, 0));
    expect(nextRunAfter("monthly", 3, new Date(2026, 2, 31, 3, 0))).toEqual(new Date(2026, 3, 30, 3, 0));
    expect(nextRunAfter("monthly", 3, new Date(2026, 11, 15, 3, 0))).toEqual(new Date(2027, 0, 15, 3, 0));
  });
});
