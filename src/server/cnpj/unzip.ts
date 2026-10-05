/**
 * Leitura em fluxo dos .zip da Receita, sem dependência externa e sem gravar o CSV em disco.
 *
 * Cada .zip do dump tem uma única entrada em deflate. O cabeçalho local (PK\x03\x04) é
 * descartado e o resto vai para `zlib.createInflateRaw`, que para sozinho no fim do fluxo
 * deflate. Assim não é preciso ler o índice central nem conhecer o tamanho descompactado —
 * o que permite processar um arquivo de gigabytes enquanto ele baixa.
 */
import { Transform, type Readable } from "node:stream";
import { createInflateRaw } from "node:zlib";

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const LOCAL_HEADER_MIN = 30;
const METHOD_DEFLATE = 8;

export class ZipFormatError extends Error {}

/**
 * Descarta o cabeçalho local da primeira entrada e repassa os bytes comprimidos.
 * Erra quando o fluxo não é um zip, está cifrado ou não usa deflate.
 */
class StripLocalHeader extends Transform {
  private head: Buffer = Buffer.alloc(0);
  private stripped = false;

  _transform(chunk: Buffer, _encoding: BufferEncoding, done: (error?: Error) => void): void {
    if (this.stripped) {
      this.push(chunk);
      done();
      return;
    }

    this.head = this.head.length === 0 ? chunk : Buffer.concat([this.head, chunk]);
    if (this.head.length < LOCAL_HEADER_MIN) {
      done();
      return;
    }
    if (this.head.readUInt32LE(0) !== LOCAL_HEADER_SIGNATURE) {
      done(
        new ZipFormatError("O arquivo baixado não é um .zip (talvez o servidor tenha devolvido uma página de erro)."),
      );
      return;
    }

    const flags = this.head.readUInt16LE(6);
    const method = this.head.readUInt16LE(8);
    const headerLength = LOCAL_HEADER_MIN + this.head.readUInt16LE(26) + this.head.readUInt16LE(28);
    if (this.head.length < headerLength) {
      done();
      return;
    }
    if ((flags & 0x1) !== 0) {
      done(new ZipFormatError("O .zip está protegido por senha."));
      return;
    }
    if (method !== METHOD_DEFLATE) {
      done(new ZipFormatError(`O .zip usa o método de compressão ${method}; só deflate é suportado.`));
      return;
    }

    this.stripped = true;
    const rest = this.head.subarray(headerLength);
    this.head = Buffer.alloc(0);
    if (rest.length > 0) this.push(rest);
    done();
  }

  _flush(done: (error?: Error) => void): void {
    done(this.stripped ? undefined : new ZipFormatError("O arquivo baixado terminou antes do cabeçalho do .zip."));
  }
}

/**
 * Bytes descompactados da única entrada do .zip.
 *
 * Usa `pipe` em vez de `pipeline`/`compose` de propósito: o inflate termina no fim do fluxo
 * deflate, antes do índice central do arquivo, e `pipeline` trataria isso como cancelamento
 * do fluxo de origem. Os erros são encaminhados à mão.
 */
export function unzipSingleEntry(source: Readable): AsyncIterable<Buffer> {
  const strip = new StripLocalHeader();
  const inflate = createInflateRaw();

  let settled = false;
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    inflate.destroy(error);
  };

  source.on("error", fail);
  strip.on("error", fail);
  // Acabou o conteúdo útil: solta o socket sem esperar o resto do arquivo.
  inflate.once("end", () => {
    settled = true;
    source.destroy();
  });

  source.pipe(strip).pipe(inflate);
  return inflate;
}

/** Tamanho dos lotes de linhas entregues ao chamador. */
export const LINE_BATCH = 2000;

/**
 * Linhas do CSV dentro do .zip, em lotes, já decodificadas de latin1.
 * latin1 mapeia byte a byte, então decodificar cada pedaço isoladamente é seguro.
 */
export async function* readZipLines(source: Readable, batchSize = LINE_BATCH): AsyncGenerator<string[]> {
  let tail = "";
  let batch: string[] = [];

  for await (const chunk of unzipSingleEntry(source)) {
    const text = tail + chunk.toString("latin1");
    const parts = text.split("\n");
    tail = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.endsWith("\r") ? part.slice(0, -1) : part;
      if (line) batch.push(line);
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }
  }

  const last = tail.endsWith("\r") ? tail.slice(0, -1) : tail;
  if (last) batch.push(last);
  if (batch.length > 0) yield batch;
}
