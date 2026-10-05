/**
 * Importação do dump de CNPJ: tabela de municípios, estabelecimentos dos municípios pedidos
 * e razão social. Tudo em fluxo — nada do CSV é carregado inteiro na memória nem gravado em
 * disco; só as linhas dos municípios pedidos chegam ao banco.
 */
import type { CnpjImportInput } from "@/lib/contract";
import { db } from "../db";
import { candidateNames, normalizeMunicipio, resolveMunicipio } from "./match";
import { parseEmpresa, parseEstabelecimento, parseMunicipio, SITUACAO_ATIVA } from "./parse";
import { CnpjSourceError, empresaFile, estabelecimentoFile, MUNICIPIOS_FILE, openFile } from "./source";
import { readZipLines } from "./unzip";

/** Linhas gravadas por transação. */
const WRITE_BATCH = 500;

/**
 * Lotes de linhas entre duas checagens de pausa. `Estabelecimentos0.zip` leva minutos e pode
 * gravar pouca coisa (depende do município), então a pausa não pode depender de gravação.
 */
const STOP_CHECK_BATCHES = 100;

// ---------- Etapa 1: municípios ----------

/**
 * Carrega a tabela de municípios da Receita e resolve os códigos das cidades pedidas.
 * A tabela é pequena (5.572 linhas) e é regravada por inteiro a cada importação.
 */
export async function importMunicipios(month: string, cities: CnpjImportInput["cities"]): Promise<{
  codes: string[];
  ufs: string[];
  unknownCities: string[];
}> {
  const stream = await openFile(month, MUNICIPIOS_FILE);
  const rows: Array<{ codigo: string; nome: string; nomeNormalizado: string }> = [];
  for await (const lines of readZipLines(stream)) {
    for (const line of lines) {
      const row = parseMunicipio(line);
      if (row) rows.push({ ...row, nomeNormalizado: normalizeMunicipio(row.nome) });
    }
  }
  if (rows.length === 0) {
    throw new CnpjSourceError("A tabela de municípios do dump veio vazia. Tente de novo mais tarde.");
  }

  await db.$transaction(async (tx) => {
    await tx.cnpjMunicipio.deleteMany({});
    for (let i = 0; i < rows.length; i += WRITE_BATCH) {
      await tx.cnpjMunicipio.createMany({ data: rows.slice(i, i + WRITE_BATCH) });
    }
  });

  const codes = new Set<string>();
  const ufs = new Set<string>();
  const unknownCities: string[] = [];
  for (const target of cities) {
    const found = resolveMunicipio(target.city, rows);
    if (found.length === 0) unknownCities.push(target.city);
    for (const code of found) codes.add(code);
    if (target.state) ufs.add(target.state.toUpperCase());
  }

  if (codes.size === 0) {
    throw new CnpjSourceError(
      `Não achei ${unknownCities.join(", ")} na tabela de municípios da Receita. Confira a grafia da cidade.`,
    );
  }
  return { codes: [...codes], ufs: [...ufs], unknownCities };
}

// ---------- Etapa 2: estabelecimentos e razão social ----------

export interface PartStats {
  scanned: number;
  saved: number;
}

interface CnpjRecord {
  cnpj: string;
  nomeFantasia: string | null;
  nomeNormalizado: string;
  razaoNormalizada: string;
  municipio: string;
  uf: string;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  cep: string | null;
  cnaePrincipal: string | null;
  situacao: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  dumpMonth: string;
}

/** Regrava o lote: apaga o que já existia e cria de novo, então rodar duas vezes não duplica. */
async function writeRecords(records: CnpjRecord[]): Promise<void> {
  if (records.length === 0) return;
  await db.$transaction(
    async (tx) => {
      await tx.cnpj.deleteMany({ where: { cnpj: { in: records.map((r) => r.cnpj) } } });
      await tx.cnpj.createMany({ data: records });
    },
    { timeout: 60_000 },
  );
}

/**
 * Lê `Estabelecimentos{part}.zip` e grava só as linhas dos municípios pedidos.
 * `shouldStop` é consultado entre lotes (pausa cooperativa); retornar `true` interrompe a leitura.
 */
export async function importEstabelecimentos(
  month: string,
  part: number,
  codes: string[],
  ufs: string[],
  shouldStop: () => Promise<boolean>,
): Promise<PartStats & { stopped: boolean }> {
  const wantedCodes = new Set(codes);
  const wantedUfs = new Set(ufs);
  const stream = await openFile(month, estabelecimentoFile(part), true);

  const stats: PartStats = { scanned: 0, saved: 0 };
  let buffer: CnpjRecord[] = [];
  let stopped = false;
  let batches = 0;

  for await (const lines of readZipLines(stream)) {
    stats.scanned += lines.length;
    batches++;
    for (const line of lines) {
      const row = parseEstabelecimento(line);
      if (!row || !wantedCodes.has(row.municipio)) continue;
      if (wantedUfs.size > 0 && !wantedUfs.has(row.uf)) continue;

      buffer.push({
        cnpj: row.cnpj,
        nomeFantasia: row.nomeFantasia,
        ...candidateNames(row.nomeFantasia, null),
        municipio: row.municipio,
        uf: row.uf,
        bairro: row.bairro,
        logradouro: row.logradouro,
        numero: row.numero,
        cep: row.cep,
        cnaePrincipal: row.cnaePrincipal,
        situacao: row.situacao,
        phone: row.phone,
        phone2: row.phone2,
        email: row.email,
        dumpMonth: month,
      });
    }

    if (buffer.length >= WRITE_BATCH) {
      await writeRecords(buffer);
      stats.saved += buffer.length;
      buffer = [];
    }
    // A pausa é checada por linhas lidas, não por linhas gravadas.
    if (batches % STOP_CHECK_BATCHES === 0 && (await shouldStop())) {
      stopped = true;
      break;
    }
  }

  if (!stopped) {
    await writeRecords(buffer);
    stats.saved += buffer.length;
  }
  // O fluxo é fechado pelo `unzipSingleEntry` no fim; sair antes também derruba o socket.
  stream.destroy();
  return { ...stats, stopped };
}

/**
 * Completa a razão social dos estabelecimentos já gravados, lendo `Empresas{part}.zip`.
 *
 * Medido no dump de 2026-09: as partes de `Empresas` **não** acompanham as de
 * `Estabelecimentos` — os CNPJ básicos se espalham pelas 10 partes, então ler só a parte 1
 * preencheu 10% das linhas. Por isso as 10 partes de `Empresas` são sempre lidas, mesmo
 * quando o usuário pede uma amostra de `Estabelecimentos` (são ~1,4 GB contra ~5,1 GB).
 *
 * Só completa estabelecimento **ativo**: o casamento ignora os demais, e isso corta ~3/4 das
 * gravações. Sem razão social o casamento continua pelo nome fantasia.
 */
export async function importRazaoSocial(month: string, part: number): Promise<number> {
  const existing = await db.cnpj.findMany({
    where: { razaoNormalizada: "", situacao: SITUACAO_ATIVA },
    select: { cnpj: true },
  });
  if (existing.length === 0) return 0;

  const wanted = new Set(existing.map((r) => r.cnpj.slice(0, 8)));
  const stream = await openFile(month, empresaFile(part), true);

  let updated = 0;
  let buffer: Array<{ cnpjBasico: string; razaoSocial: string }> = [];

  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    await db.$transaction(
      async (tx) => {
        for (const { cnpjBasico, razaoSocial } of batch) {
          const result = await tx.cnpj.updateMany({
            // Faixa na chave primária em vez de `startsWith`: o CNPJ tem 14 dígitos, então
            // todos os estabelecimentos deste básico ficam entre `básico000000` e `básico999999`.
            // `startsWith` viraria `LIKE`, que varre a tabela inteira a cada linha.
            where: { cnpj: { gte: `${cnpjBasico}000000`, lte: `${cnpjBasico}999999` } },
            data: { razaoSocial, razaoNormalizada: candidateNames(null, razaoSocial).razaoNormalizada },
          });
          updated += result.count;
        }
      },
      { timeout: 120_000 },
    );
  };

  for await (const lines of readZipLines(stream)) {
    for (const line of lines) {
      const row = parseEmpresa(line);
      if (!row || !wanted.has(row.cnpjBasico)) continue;
      buffer.push(row);
    }
    if (buffer.length >= WRITE_BATCH) await flush();
  }
  await flush();
  stream.destroy();
  return updated;
}

/** Quantos estabelecimentos ativos existem na base local para os municípios pedidos. */
export async function countActive(codes: string[]): Promise<number> {
  return db.cnpj.count({ where: { municipio: { in: codes }, situacao: SITUACAO_ATIVA } });
}
