import { describe, expect, it } from "vitest";
import { buildPhone, parseEmail, parseEmpresa, parseEstabelecimento, parseMunicipio, splitCsvLine } from "./parse";

// Linhas reais do dump de 2026-09 (Estabelecimentos1.zip / Empresas1.zip / Municipios.zip).
const BAIXADA =
  '"07396865";"0001";"68";"1";"";"08";"20170210";"01";"";"";"20050518";"1412602";"1411801";"RUA";"TUCANEIRA";"30";"";"DOS LAGOS";"89136000";"SC";"8297";"47";"33851125";"47";"33851125";"47";"33851125";"";"";""';
const COM_EMAIL =
  '"64904295";"0018";"51";"2";"";"08";"20161110";"01";"";"";"20050429";"4639701";"4637199";"AVENIDA";"MENINO MARCELO";"8551B";"LOTE  2                   QUADRAF";"SERRARIA";"57046000";"AL";"2785";"11";"36491000";"31";"33880436";"82";"33118379";"CLAUDIO.GIGLIO@CAMIL.COM.BR";"";""';
const ATIVA_SEM_TELEFONE =
  '"76016369";"0003";"16";"2";"";"02";"20260616";"00";"";"";"19851212";"4632001";"";"RUA";"DO COMERCIO";"55";"SALA 7 GALERIA";"CENTRO";"11010141";"SP";"7071";"";"";"";"";"";"";"";"";""';

describe("splitCsvLine", () => {
  it("tira as aspas de todos os campos, inclusive os vazios", () => {
    expect(splitCsvLine('"0001";"GUAJARA-MIRIM"')).toEqual(["0001", "GUAJARA-MIRIM"]);
    expect(splitCsvLine('"a";"";"c"')).toEqual(["a", "", "c"]);
  });

  it("ponto e vírgula dentro de aspas faz parte do valor", () => {
    expect(splitCsvLine('"RUA A; 10";"CENTRO"')).toEqual(["RUA A; 10", "CENTRO"]);
  });

  it("aspas duplicadas viram uma aspa", () => {
    expect(splitCsvLine('"BAR ""DO ZE""";"CENTRO"')).toEqual(['BAR "DO ZE"', "CENTRO"]);
  });
});

describe("buildPhone", () => {
  it("monta +55 DD NNNNNNNNN", () => {
    expect(buildPhone("19", "33683348")).toBe("+55 19 33683348");
    expect(buildPhone("19", "988887777")).toBe("+55 19 988887777");
  });

  it("recusa preenchimento zerado do dump e tamanhos fora da faixa", () => {
    expect(buildPhone("0000", "00000000")).toBeNull();
    expect(buildPhone("19", "00000000")).toBeNull();
    expect(buildPhone("", "")).toBeNull();
    expect(buildPhone("19", "3368334")).toBeNull();
    expect(buildPhone("190", "33683348")).toBeNull();
    expect(buildPhone(null, null)).toBeNull();
  });
});

describe("parseEmail", () => {
  it("minúsculas e descarte do que não é e-mail", () => {
    expect(parseEmail("CLAUDIO.GIGLIO@CAMIL.COM.BR")).toBe("claudio.giglio@camil.com.br");
    expect(parseEmail("nao tem")).toBeNull();
    expect(parseEmail("")).toBeNull();
    expect(parseEmail(null)).toBeNull();
  });
});

describe("parseEstabelecimento", () => {
  it("monta o CNPJ de 14 dígitos e lê endereço, situação e telefones", () => {
    const row = parseEstabelecimento(BAIXADA);
    expect(row).not.toBeNull();
    expect(row?.cnpj).toBe("07396865000168");
    expect(row?.situacao).toBe("08");
    expect(row?.cnaePrincipal).toBe("1412602");
    expect(row?.logradouro).toBe("RUA TUCANEIRA");
    expect(row?.numero).toBe("30");
    expect(row?.bairro).toBe("DOS LAGOS");
    expect(row?.cep).toBe("89136000");
    expect(row?.uf).toBe("SC");
    expect(row?.municipio).toBe("8297");
    expect(row?.phone).toBe("+55 47 33851125");
    expect(row?.email).toBeNull();
    expect(row?.nomeFantasia).toBeNull();
  });

  it("lê o e-mail e o segundo telefone", () => {
    const row = parseEstabelecimento(COM_EMAIL);
    expect(row?.email).toBe("claudio.giglio@camil.com.br");
    expect(row?.phone).toBe("+55 11 36491000");
    expect(row?.phone2).toBe("+55 31 33880436");
  });

  it("estabelecimento ativo sem telefone fica com telefone nulo", () => {
    const row = parseEstabelecimento(ATIVA_SEM_TELEFONE);
    expect(row?.situacao).toBe("02");
    expect(row?.municipio).toBe("7071");
    expect(row?.phone).toBeNull();
    expect(row?.phone2).toBeNull();
  });

  it("descarta linha curta, vazia ou sem CNPJ válido", () => {
    expect(parseEstabelecimento("")).toBeNull();
    expect(parseEstabelecimento('"123";"0001";"68"')).toBeNull();
    expect(parseEstabelecimento(BAIXADA.replace('"07396865"', '"073"'))).toBeNull();
  });
});

describe("parseEmpresa e parseMunicipio", () => {
  it("lê CNPJ básico e razão social", () => {
    expect(parseEmpresa('"00000000";"BANCO DO BRASIL SA";"2038";"10";"120000000000,00";"05";""')).toEqual({
      cnpjBasico: "00000000",
      razaoSocial: "BANCO DO BRASIL SA",
    });
    expect(parseEmpresa('"00000000";"";"2038";"10";"0,00";"05";""')).toBeNull();
    expect(parseEmpresa("")).toBeNull();
  });

  it("lê código e nome do município", () => {
    expect(parseMunicipio('"6291";"CAMPINAS"')).toEqual({ codigo: "6291", nome: "CAMPINAS" });
    expect(parseMunicipio('"";"CAMPINAS"')).toBeNull();
  });
});
