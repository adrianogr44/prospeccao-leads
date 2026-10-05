/**
 * Casamento entre um lead e os estabelecimentos do dump da Receita. Funções puras.
 *
 * A normalização de nome é a mesma do dedupe de leads (`leads/normalize.ts`), para o nome
 * do lead e o do CNPJ passarem exatamente pela mesma régua.
 */
import { isMobileBR, normalizeName, stripAccents } from "../leads/normalize";

/**
 * Confiança mínima para gravar o contato. Documentado na story 1.6.
 *
 * Escala: o nome vale 1,00 (nome fantasia idêntico), 0,90 (razão social idêntica) ou
 * 0,75 (nome do lead é o começo do nome do CNPJ); bairro e logradouro somam 0,10 cada.
 * Com 0,80 de limiar, um nome idêntico casa sozinho, e um nome só parecido (0,75) **exige**
 * confirmação de bairro ou de logradouro.
 */
export const MIN_CONFIDENCE = 0.8;

const NAME_EXACT_FANTASIA = 1;
const NAME_EXACT_RAZAO = 0.9;
const NAME_PREFIX = 0.75;
const ADDRESS_BONUS = 0.1;

/** Nome do lead curto demais (uma palavra de menos de 10 letras) não casa por prefixo. */
const MIN_PREFIX_CHARS = 10;

export interface CnpjCandidate {
  cnpj: string;
  nomeFantasia: string | null;
  razaoSocial: string | null;
  /** `normalizeName(nomeFantasia)` */
  nomeNormalizado: string;
  /** `normalizeName(razaoSocial)` */
  razaoNormalizada: string;
  bairro: string | null;
  logradouro: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
}

export interface MatchTarget {
  name: string;
  neighborhood: string | null;
  address: string | null;
}

export interface Match {
  candidate: CnpjCandidate;
  /** 0 a 1; `MIN_CONFIDENCE` é o mínimo aceito. */
  confidence: number;
  reasons: string[];
}

export type MatchOutcome =
  | { kind: "match"; match: Match }
  /** Mais de um candidato empatado no topo: não grava nada (critério 3 da story). */
  | { kind: "ambiguous"; candidates: Match[] }
  | { kind: "none" };

/** Texto comparável de endereço: minúsculas, sem acento e sem pontuação. */
export function normalizePlaceText(value: string | null | undefined): string {
  if (!value) return "";
  return stripAccents(value.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * `true` quando `full` começa com `prefix` terminando em limite de palavra.
 * "taishi restaurante" começa com "taishi"; "taishiro" não.
 */
function startsWithWord(full: string, prefix: string): boolean {
  if (!full.startsWith(prefix)) return false;
  return full.length === prefix.length || full[prefix.length] === " ";
}

interface NameScore {
  score: number;
  reason: string;
}

function scoreName(target: string, candidate: CnpjCandidate): NameScore | null {
  if (candidate.nomeNormalizado && candidate.nomeNormalizado === target) {
    return { score: NAME_EXACT_FANTASIA, reason: "Nome fantasia igual" };
  }
  if (candidate.razaoNormalizada && candidate.razaoNormalizada === target) {
    return { score: NAME_EXACT_RAZAO, reason: "Razão social igual" };
  }

  const words = target.split(" ").filter(Boolean).length;
  if (words < 2 && target.length < MIN_PREFIX_CHARS) return null;

  if (candidate.nomeNormalizado && startsWithWord(candidate.nomeNormalizado, target)) {
    return { score: NAME_PREFIX, reason: "Nome fantasia começa com o nome do lead" };
  }
  if (candidate.razaoNormalizada && startsWithWord(candidate.razaoNormalizada, target)) {
    return { score: NAME_PREFIX, reason: "Razão social começa com o nome do lead" };
  }
  return null;
}

function scoreAddress(target: MatchTarget, candidate: CnpjCandidate): NameScore[] {
  const signals: NameScore[] = [];

  const bairro = normalizePlaceText(candidate.bairro);
  const leadBairro = normalizePlaceText(target.neighborhood);
  if (bairro && leadBairro && bairro === leadBairro) {
    signals.push({ score: ADDRESS_BONUS, reason: "Mesmo bairro" });
  }

  // O endereço do lead vem numa linha só ("Rua Albano de Almeida Lima, 164 - Jardim Guanabara").
  const logradouro = normalizePlaceText(candidate.logradouro);
  const leadAddress = normalizePlaceText(target.address);
  if (logradouro.length >= 6 && leadAddress && leadAddress.includes(logradouro)) {
    signals.push({ score: ADDRESS_BONUS, reason: "Mesmo logradouro" });
  }

  return signals;
}

/** Nomes comparáveis de um estabelecimento, prontos para gravar no índice. */
export function candidateNames(nomeFantasia: string | null, razaoSocial: string | null): {
  nomeNormalizado: string;
  razaoNormalizada: string;
} {
  return {
    nomeNormalizado: nomeFantasia ? normalizeName(nomeFantasia) : "",
    razaoNormalizada: razaoSocial ? normalizeName(razaoSocial) : "",
  };
}

/**
 * Escolhe o estabelecimento do lead entre os candidatos **do mesmo município e UF**
 * (o filtro geográfico é de quem busca os candidatos).
 *
 * Aceita só quando um candidato fica sozinho acima do limiar, ou quando um deles está
 * estritamente à frente dos outros. Empate no topo devolve `ambiguous` e nada é gravado.
 */
export function matchEstablishment(target: MatchTarget, candidates: CnpjCandidate[]): MatchOutcome {
  const name = normalizeName(target.name);
  if (!name) return { kind: "none" };

  const scored: Array<{ raw: number; match: Match }> = [];
  for (const candidate of candidates) {
    const nameScore = scoreName(name, candidate);
    if (!nameScore) continue;

    const address = scoreAddress(target, candidate);
    // `raw` passa de 1 quando há confirmação de endereço: é o que desempata nomes idênticos.
    const raw = nameScore.score + address.reduce((sum, s) => sum + s.score, 0);
    const confidence = Math.min(1, raw);
    if (confidence < MIN_CONFIDENCE) continue;

    scored.push({
      raw,
      match: { candidate, confidence, reasons: [nameScore.reason, ...address.map((s) => s.reason)] },
    });
  }

  if (scored.length === 0) return { kind: "none" };

  scored.sort((a, b) => b.raw - a.raw);
  const tied = scored.filter((s) => s.raw === scored[0].raw);
  if (tied.length > 1) return { kind: "ambiguous", candidates: tied.map((s) => s.match) };
  return { kind: "match", match: scored[0].match };
}

// ---------- Gravação do contato ----------

export interface ContactState {
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
}

export interface ContactUpdate {
  phone?: string;
  phoneIsMobile?: boolean;
  email?: string;
}

/**
 * O que o estabelecimento acrescenta ao lead. Só preenche campo vazio: WhatsApp, telefone e
 * e-mail já existentes nunca são tocados (critério 2 da story).
 *
 * O telefone do CNPJ entra em `phone`, nunca em `whatsapp` — a Receita não diz que o número
 * atende no WhatsApp, e o app só marca WhatsApp quando a empresa publicou.
 */
export function contactUpdate(lead: ContactState, candidate: CnpjCandidate): ContactUpdate {
  const update: ContactUpdate = {};

  if (!lead.phone) {
    const phone = candidate.phone ?? candidate.phone2;
    if (phone) {
      update.phone = phone;
      update.phoneIsMobile = isMobileBR(phone);
    }
  }
  if (!lead.email && candidate.email) update.email = candidate.email;

  return update;
}

// ---------- Município ----------

export interface MunicipioRow {
  codigo: string;
  nomeNormalizado: string;
}

/** Nome de município comparável: minúsculas, sem acento, sem pontuação. */
export function normalizeMunicipio(name: string): string {
  return normalizePlaceText(name);
}

/**
 * Códigos de município da Receita com o nome pedido. A tabela de municípios não traz UF,
 * então homônimos ("Campinas", "Campinas do Sul", "Campinas do Piauí") devolvem mais de um
 * código quando o nome é igual; a UF do estabelecimento é que decide depois.
 */
export function resolveMunicipio(city: string, rows: MunicipioRow[]): string[] {
  const wanted = normalizeMunicipio(city);
  if (!wanted) return [];
  return rows.filter((r) => r.nomeNormalizado === wanted).map((r) => r.codigo);
}
