/** Extração de contatos e redes sociais a partir de HTML e URLs. Funções puras. */

export type SocialKind = "instagram" | "facebook" | "linkedin" | "tiktok" | "whatsapp" | "other";

export interface SocialLink {
  kind: SocialKind;
  /** Valor pronto para gravar (URL canônica da rede ou dígitos do WhatsApp); null se não há perfil/número */
  value: string | null;
}

export interface PageContacts {
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
  email?: string;
}

const HOSTS: Array<{ kind: SocialKind; hosts: string[] }> = [
  { kind: "instagram", hosts: ["instagram.com", "instagr.am"] },
  { kind: "facebook", hosts: ["facebook.com", "fb.com", "fb.me"] },
  { kind: "linkedin", hosts: ["linkedin.com"] },
  { kind: "tiktok", hosts: ["tiktok.com"] },
  { kind: "whatsapp", hosts: ["wa.me", "api.whatsapp.com", "web.whatsapp.com", "whatsapp.com"] },
  {
    kind: "other",
    hosts: [
      "linktr.ee",
      "linktree.com",
      "beacons.ai",
      "bio.link",
      "linkin.bio",
      "taplink.cc",
      "campsite.bio",
      "lnk.bio",
      "youtube.com",
      "youtu.be",
      "twitter.com",
      "x.com",
    ],
  },
];

const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "accounts", "stories", "tv", "share", "direct", "about", "developer"]);
const FB_RESERVED = new Set([
  "sharer",
  "sharer.php",
  "share",
  "share.php",
  "plugins",
  "dialog",
  "tr",
  "login",
  "login.php",
  "policies",
  "hashtag",
  "help",
  "legal",
  "privacy",
  "business",
  "ads",
  "watch",
  "l.php",
  "events",
]);

function toUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!value || (value.startsWith("/") && !value.startsWith("//"))) return null;
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value);
    if (value.startsWith("//")) return new URL(`https:${value}`);
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[^/]+\.[a-z]{2,}(:\d+)?(\/|$)/i.test(value)) return null; // mailto:, tel:...
    return new URL(`https://${value}`);
  } catch {
    return null;
  }
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function segments(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean);
}

function whatsappDigits(url: URL): string | null {
  const fromPath = segments(url)[0];
  const candidate = url.searchParams.get("phone") ?? (fromPath && /^\+?\d+$/.test(fromPath) ? fromPath : null);
  const digits = candidate?.replace(/\D/g, "") ?? "";
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** Reconhece um link de rede social/mensageiro e devolve o valor canônico. */
export function parseSocialHref(raw: string): SocialLink | null {
  const url = toUrl(raw);
  if (!url || !/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const kind = HOSTS.find((h) => h.hosts.some((d) => hostMatches(host, d)))?.kind;
  if (!kind) return null;

  const seg = segments(url);
  switch (kind) {
    case "instagram": {
      const handle = seg[0];
      if (handle && !IG_RESERVED.has(handle.toLowerCase()) && /^[a-z0-9._]{1,30}$/i.test(handle)) {
        return { kind, value: `https://www.instagram.com/${handle}` };
      }
      return { kind, value: null };
    }
    case "facebook": {
      const first = seg[0]?.toLowerCase();
      if (!first || FB_RESERVED.has(first)) return { kind, value: null };
      if (first === "profile.php") {
        const id = url.searchParams.get("id");
        return { kind, value: id && /^\d+$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null };
      }
      if (first === "pages" && seg.length >= 3) return { kind, value: `https://www.facebook.com/${seg.slice(0, 3).join("/")}` };
      return { kind, value: `https://www.facebook.com/${seg[0]}` };
    }
    case "linkedin": {
      const [type, slug] = seg;
      if (type && slug && ["company", "in", "school"].includes(type.toLowerCase())) {
        return { kind, value: `https://www.linkedin.com/${type.toLowerCase()}/${slug}` };
      }
      return { kind, value: null };
    }
    case "tiktok": {
      const handle = seg[0];
      return { kind, value: handle?.startsWith("@") && handle.length > 1 ? `https://www.tiktok.com/${handle}` : null };
    }
    case "whatsapp":
      return { kind, value: whatsappDigits(url) };
    default:
      return { kind, value: null };
  }
}

/** Monta a URL da rede a partir de um @usuario ou URL parcial (usado nos campos do OSM). */
export function socialUrl(kind: "instagram" | "facebook", raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const parsed = parseSocialHref(value);
  if (parsed?.kind === kind) return parsed.value;
  if (/^[a-z0-9._-]+$/i.test(value.replace(/^@/, "")) && !value.includes(".com")) {
    const handle = value.replace(/^@/, "");
    return kind === "instagram" ? `https://www.instagram.com/${handle}` : `https://www.facebook.com/${handle}`;
  }
  return null;
}

const HREF_RE = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const WA_RE = /(?:wa\.me\/|whatsapp\.com\/send\/?\?(?:[^"'\s>]*?&(?:amp;)?)?phone=)\+?(\d{10,15})/i;
const MAILTO_RE = /mailto:([^"'?\s>]+)/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const EMAIL_IGNORED = /@(?:example\.|sentry|wixpress\.|domain\.com)|\.(?:png|jpe?g|gif|webp|svg)$/i;

function decodeAmp(s: string): string {
  return s.replace(/&amp;/gi, "&");
}

/** Só devolve o que a página publica explicitamente; nunca deduz WhatsApp a partir do telefone. */
export function extractContacts(html: string): PageContacts {
  const out: PageContacts = {};

  for (const match of html.matchAll(HREF_RE)) {
    const href = decodeAmp((match[1] ?? match[2] ?? "").trim());
    const link = parseSocialHref(href);
    if (!link?.value) continue;
    if (link.kind === "whatsapp") out.whatsapp ??= link.value;
    else if (link.kind === "instagram" || link.kind === "facebook" || link.kind === "linkedin" || link.kind === "tiktok") {
      out[link.kind] ??= link.value;
    }
  }

  // Números em botões/scripts que não estão em href.
  if (!out.whatsapp) {
    const wa = WA_RE.exec(decodeAmp(html));
    if (wa) out.whatsapp = wa[1];
  }

  const mail = MAILTO_RE.exec(html);
  if (mail) {
    let email = mail[1];
    try {
      email = decodeURIComponent(email);
    } catch {
      /* mantém o valor original */
    }
    email = email.trim().toLowerCase();
    if (EMAIL_RE.test(email) && !EMAIL_IGNORED.test(email)) out.email = email;
  }
  return out;
}
