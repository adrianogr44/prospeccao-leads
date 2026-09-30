import { describe, expect, it } from "vitest";
import { escapeCsvCell, guardFormula, toCsv } from "./csv";

describe("guardFormula", () => {
  it("prefixa apóstrofo em células que começam com = + - @", () => {
    expect(guardFormula("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(guardFormula("+5511999998888")).toBe("'+5511999998888");
    expect(guardFormula("-2+3")).toBe("'-2+3");
    expect(guardFormula("@cmd")).toBe("'@cmd");
    expect(guardFormula("Padaria")).toBe("Padaria");
  });
});

describe("escapeCsvCell", () => {
  it("entre aspas quando tem ;, aspas ou quebra de linha", () => {
    expect(escapeCsvCell("a;b")).toBe('"a;b"');
    expect(escapeCsvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(escapeCsvCell("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });

  it("nulo vira vazio e número segue como está", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(4.5)).toBe("4.5");
  });
});

describe("toCsv", () => {
  const csv = toCsv(["Nome", "Cidade"], [["Padaria Pão Quente", "São Paulo"], ["=HYPERLINK(\"x\")", null]]);

  it("começa com BOM UTF-8 para o Excel reconhecer os acentos", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(Buffer.from(csv, "utf8").subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(csv).toContain("Padaria Pão Quente;São Paulo");
  });

  it("usa ; e CRLF, e neutraliza fórmulas", () => {
    const expected = ["Nome;Cidade", "Padaria Pão Quente;São Paulo", `"'=HYPERLINK(""x"")";`].join("\r\n") + "\r\n";
    expect(csv.slice(1)).toBe(expected);
  });
});
