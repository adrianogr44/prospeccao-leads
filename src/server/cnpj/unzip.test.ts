import { Readable } from "node:stream";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readZipLines, ZipFormatError } from "./unzip";

/** Monta um .zip de uma entrada no mesmo formato dos arquivos da Receita (deflate, latin1). */
function zipOf(content: string, { flags = 0, method = 8 } = {}): Buffer {
  const raw = Buffer.from(content, "latin1");
  const body = method === 8 ? deflateRawSync(raw) : raw;
  const name = Buffer.from("K3241.K03200Y1.D60912.ESTABELE", "latin1");

  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // versão
  header.writeUInt16LE(flags, 6);
  header.writeUInt16LE(method, 8);
  header.writeUInt32LE(0, 14); // crc32 (não é lido)
  header.writeUInt32LE(body.length, 18);
  header.writeUInt32LE(raw.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);

  // Índice central: o leitor em fluxo ignora, mas o arquivo real o tem.
  const central = Buffer.alloc(22);
  central.writeUInt32LE(0x06054b50, 0);
  return Buffer.concat([header, name, body, central]);
}

/** Entrega o .zip em pedaços pequenos, para o cabeçalho cair no meio de um chunk. */
function inChunks(buffer: Buffer, size: number): Readable {
  const parts: Buffer[] = [];
  for (let i = 0; i < buffer.length; i += size) parts.push(buffer.subarray(i, i + size));
  return Readable.from(parts);
}

async function linesOf(source: Readable, batchSize = 2): Promise<string[]> {
  const out: string[] = [];
  for await (const batch of readZipLines(source, batchSize)) out.push(...batch);
  return out;
}

describe("readZipLines", () => {
  const csv = '"6291";"CAMPINAS"\n"7107";"SAO PAULO"\n"5413";"VARGINHA"\n';

  it("lê as linhas de um zip de uma entrada", async () => {
    expect(await linesOf(Readable.from([zipOf(csv)]))).toEqual([
      '"6291";"CAMPINAS"',
      '"7107";"SAO PAULO"',
      '"5413";"VARGINHA"',
    ]);
  });

  it("funciona com o cabeçalho partido entre pedaços do download", async () => {
    expect(await linesOf(inChunks(zipOf(csv), 7))).toHaveLength(3);
  });

  it("decodifica latin1 e preserva a última linha sem quebra final", async () => {
    const lines = await linesOf(Readable.from([zipOf('"1";"SÃO JOÃO"\n"2";"MARAÚ"')]));
    expect(lines).toEqual(['"1";"SÃO JOÃO"', '"2";"MARAÚ"']);
  });

  it("entrega em lotes do tamanho pedido", async () => {
    const batches: number[] = [];
    for await (const batch of readZipLines(Readable.from([zipOf(csv)]), 2)) batches.push(batch.length);
    expect(batches).toEqual([2, 1]);
  });

  it("recusa método de compressão que não é deflate", async () => {
    await expect(linesOf(Readable.from([zipOf(csv, { method: 0 })]))).rejects.toThrow(/deflate/);
  });

  it("recusa conteúdo que não é zip (página de erro do servidor)", async () => {
    await expect(linesOf(Readable.from([Buffer.from("<html>404</html>".padEnd(40, " "))]))).rejects.toThrow(
      ZipFormatError,
    );
  });

  it("recusa zip com senha", async () => {
    await expect(linesOf(Readable.from([zipOf(csv, { flags: 0x1 })]))).rejects.toThrow(/senha/);
  });

  it("recusa fluxo que termina antes do cabeçalho", async () => {
    await expect(linesOf(Readable.from([Buffer.from([0x50, 0x4b])]))).rejects.toThrow(ZipFormatError);
  });
});
