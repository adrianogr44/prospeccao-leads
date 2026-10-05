/**
 * Leitura das linhas dos Dados Abertos de CNPJ da Receita Federal. Funções puras.
 *
 * Formato confirmado nos arquivos de 2026-09 e no layout oficial
 * (https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf):
 * um CSV por .zip, separador `;`, codificação latin1 (ISO-8859-1), quebra de linha `\n`,
 * sem linha de cabeçalho e **todos** os campos entre aspas duplas, inclusive os vazios.
 */

/** Índices das colunas de `Estabelecimentos*` (30 colunas). */
export const ESTABELECIMENTO = {
  cnpjBasico: 0,
  cnpjOrdem: 1,
  cnpjDv: 2,
  matrizFilial: 3,
  nomeFantasia: 4,
  situacaoCadastral: 5,
  dataSituacaoCadastral: 6,
  motivoSituacaoCadastral: 7,
  nomeCidadeExterior: 8,
  pais: 9,
  dataInicioAtividade: 10,
  cnaePrincipal: 11,
  cnaeSecundaria: 12,
  tipoLogradouro: 13,
  logradouro: 14,
  numero: 15,
  complemento: 16,
  bairro: 17,
  cep: 18,
  uf: 19,
  municipio: 20,
  ddd1: 21,
  telefone1: 22,
  ddd2: 23,
  telefone2: 24,
  dddFax: 25,
  fax: 26,
  email: 27,
  situacaoEspecial: 28,
  dataSituacaoEspecial: 29,
} as const;

/** Índices das colunas de `Empresas*` (7 colunas). */
export const EMPRESA = {
  cnpjBasico: 0,
  razaoSocial: 1,
  naturezaJuridica: 2,
  qualificacaoResponsavel: 3,
  capitalSocial: 4,
  porte: 5,
  enteFederativo: 6,
} as const;

/** Situação cadastral `02` = ativa. Só estabelecimento ativo serve para prospecção. */
export const SITUACAO_ATIVA = "02";

/**
 * Separa uma linha em campos respeitando aspas duplas: um `;` dentro de aspas faz parte
 * do valor e `""` representa uma aspa literal.
 */
export function splitCsvLine(line: string, separator = ";"): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char !== '"') current += char;
      else if (line[i + 1] === '"') {
        current += '"';
        i++;
      } else quoted = false;
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Valor de texto aparado; vazio vira null. */
function text(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** Código numérico; "0", "00" e "0000" (preenchimento do dump) viram null. */
function code(value: string | undefined): string | null {
  const v = value?.trim();
  return v && /[1-9]/.test(v) ? v : null;
}

/**
 * Telefone no formato usado pelo app: `+55 DD NNNNNNNNN`.
 * Null quando o DDD não tem 2 dígitos, o número não tem 8 ou 9, ou um dos dois é só zeros
 * (o dump preenche com "0000"/"00000000" quando não há telefone).
 */
export function buildPhone(ddd: string | null, numero: string | null): string | null {
  const area = (ddd ?? "").replace(/\D/g, "");
  const digits = (numero ?? "").replace(/\D/g, "");
  if (area.length !== 2 || digits.length < 8 || digits.length > 9) return null;
  if (!/[1-9]/.test(area) || !/[1-9]/.test(digits)) return null;
  return `+55 ${area} ${digits}`;
}

/** E-mail do cadastro em minúsculas; descarta o que não tem a forma de e-mail. */
export function parseEmail(raw: string | null): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return null;
  return value;
}

export interface EstabelecimentoRow {
  cnpj: string;
  nomeFantasia: string | null;
  situacao: string | null;
  cnaePrincipal: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string;
  municipio: string;
  phone: string | null;
  phone2: string | null;
  email: string | null;
}

/**
 * Converte uma linha de `Estabelecimentos` nos campos que o app guarda.
 * Null quando a linha é curta demais ou o CNPJ/município não são válidos.
 */
export function parseEstabelecimento(line: string): EstabelecimentoRow | null {
  if (!line) return null;
  const f = splitCsvLine(line);
  if (f.length < 28) return null;

  const basico = (f[ESTABELECIMENTO.cnpjBasico] ?? "").replace(/\D/g, "");
  const ordem = (f[ESTABELECIMENTO.cnpjOrdem] ?? "").replace(/\D/g, "");
  const dv = (f[ESTABELECIMENTO.cnpjDv] ?? "").replace(/\D/g, "");
  const municipio = (f[ESTABELECIMENTO.municipio] ?? "").trim();
  if (basico.length !== 8 || ordem.length !== 4 || dv.length !== 2 || !municipio) return null;

  // O tipo vem separado do nome da rua: "RUA" + "DAS FLORES".
  const logradouro =
    [text(f[ESTABELECIMENTO.tipoLogradouro]), text(f[ESTABELECIMENTO.logradouro])].filter(Boolean).join(" ") || null;

  return {
    cnpj: `${basico}${ordem}${dv}`,
    nomeFantasia: text(f[ESTABELECIMENTO.nomeFantasia]),
    situacao: code(f[ESTABELECIMENTO.situacaoCadastral]),
    cnaePrincipal: code(f[ESTABELECIMENTO.cnaePrincipal]),
    logradouro,
    numero: text(f[ESTABELECIMENTO.numero]),
    bairro: text(f[ESTABELECIMENTO.bairro]),
    cep: code(f[ESTABELECIMENTO.cep]),
    uf: (f[ESTABELECIMENTO.uf] ?? "").trim().toUpperCase(),
    municipio,
    phone: buildPhone(text(f[ESTABELECIMENTO.ddd1]), text(f[ESTABELECIMENTO.telefone1])),
    phone2: buildPhone(text(f[ESTABELECIMENTO.ddd2]), text(f[ESTABELECIMENTO.telefone2])),
    email: parseEmail(text(f[ESTABELECIMENTO.email])),
  };
}

/** Linha de `Empresas`: CNPJ básico (8 dígitos) e razão social. */
export function parseEmpresa(line: string): { cnpjBasico: string; razaoSocial: string } | null {
  if (!line) return null;
  const f = splitCsvLine(line);
  const basico = (f[EMPRESA.cnpjBasico] ?? "").replace(/\D/g, "");
  const razaoSocial = text(f[EMPRESA.razaoSocial]);
  if (basico.length !== 8 || !razaoSocial) return null;
  return { cnpjBasico: basico, razaoSocial };
}

/** Linha de `Municipios`: código da Receita (4 dígitos) e nome, sem UF. */
export function parseMunicipio(line: string): { codigo: string; nome: string } | null {
  if (!line) return null;
  const f = splitCsvLine(line);
  const codigo = (f[0] ?? "").trim();
  const nome = text(f[1]);
  if (!codigo || !nome) return null;
  return { codigo, nome };
}
