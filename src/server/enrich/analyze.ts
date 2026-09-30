/** Heurística de "site antigo". Pura: recebe o HTML já baixado. */

export interface AnalyzeInput {
  html: string;
  /** URL final depois dos redirecionamentos */
  finalUrl: string;
  /** Cabeçalho Last-Modified, se houver */
  lastModified?: string | null;
  now?: Date;
}

export interface AnalyzeResult {
  status: "OLD" | "OK";
  signals: string[];
}

export const SIGNAL = {
  noHttps: "Site sem HTTPS (conexão não segura)",
  noViewport: "Site sem versão para celular",
  flash: "Usa Flash (tecnologia descontinuada)",
  frames: "Usa frames (técnica ultrapassada)",
  oldTags: "Usa tags de HTML antigas (font/marquee)",
  tables: "Layout montado com tabelas",
  jquery: "Usa jQuery 1.x (versão muito antiga)",
} as const;

const MAX_AGE_YEARS = 4;

const VIEWPORT_RE = /<meta[^>]+name\s*=\s*["']?viewport/i;
const COPYRIGHT_RE = /(?:©|&copy;|&#169;|&#xa9;|copyright)\s*(?:\(c\)\s*)?(?:(?:19|20)\d{2}\s*(?:-|–|—|&ndash;|&#8211;|a|to)\s*)?((?:19|20)\d{2})/gi;
const GENERATOR_RE = /<meta[^>]+name\s*=\s*["']generator["'][^>]*content\s*=\s*["']([^"']+)["']|<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']generator["']/i;

function copyrightYear(html: string, currentYear: number): number | null {
  let latest: number | null = null;
  for (const m of html.matchAll(COPYRIGHT_RE)) {
    const year = Number(m[1]);
    if (year >= 1995 && year <= currentYear + 1 && (latest === null || year > latest)) latest = year;
  }
  return latest;
}

/** CMS em versão sem suporte, a partir da meta generator. */
function outdatedGenerator(content: string): string | null {
  if (/frontpage|dreamweaver|netobjects|microsoft word/i.test(content)) return `Feito com ferramenta antiga (${content})`;
  const m = /(wordpress|joomla!?|drupal)\s*(\d+)/i.exec(content);
  if (!m) return null;
  const major = Number(m[2]);
  const limit: Record<string, number> = { wordpress: 5, joomla: 4, drupal: 9 };
  const name = m[1].toLowerCase().replace("!", "");
  return major < limit[name] ? `Versão antiga de ${m[1].replace("!", "")} (${content})` : null;
}

export function analyzeSite({ html, finalUrl, lastModified, now = new Date() }: AnalyzeInput): AnalyzeResult {
  const signals: string[] = [];
  const year = now.getFullYear();

  if (finalUrl.toLowerCase().startsWith("http://")) signals.push(SIGNAL.noHttps);

  const noViewport = !VIEWPORT_RE.test(html);
  if (noViewport) signals.push(SIGNAL.noViewport);

  const copy = copyrightYear(html, year);
  if (copy !== null && year - copy >= MAX_AGE_YEARS) signals.push(`Direitos autorais de ${copy} (site sem atualização)`);

  if (/\.swf\b|x-shockwave-flash|<embed[^>]+flash/i.test(html)) signals.push(SIGNAL.flash);
  if (/<frameset[\s>]/i.test(html)) signals.push(SIGNAL.frames);
  if (/<font[\s>]|<marquee[\s>]/i.test(html)) signals.push(SIGNAL.oldTags);

  const tables = (html.match(/<table[\s>]/gi) ?? []).length;
  const divs = (html.match(/<div[\s>]/gi) ?? []).length;
  if (tables >= 3 && divs < tables) signals.push(SIGNAL.tables);

  if (/jquery[-.\/@]v?1\.\d+/i.test(html)) signals.push(SIGNAL.jquery);

  const gen = GENERATOR_RE.exec(html);
  const generator = gen ? (gen[1] ?? gen[2]) : null;
  const oldGen = generator ? outdatedGenerator(generator) : null;
  if (oldGen) signals.push(oldGen);

  if (lastModified) {
    const modified = new Date(lastModified);
    if (!Number.isNaN(modified.getTime()) && year - modified.getFullYear() >= MAX_AGE_YEARS) {
      signals.push(`Última modificação em ${modified.getFullYear()}`);
    }
  }

  // Sem viewport sozinho já basta para OLD.
  return { status: signals.length >= 2 || noViewport ? "OLD" : "OK", signals };
}
