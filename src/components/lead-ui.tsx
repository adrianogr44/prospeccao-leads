import type { ReactNode } from "react";
import { SITE_STATUS_LABEL, type LeadDTO, type SiteStatus } from "@/lib/contract";
import { cx } from "@/lib/cx";
import { instagramUrl, whatsappUrl } from "@/lib/format";
import { CheckIcon, InstagramIcon, MailIcon, PhoneIcon, WhatsappIcon } from "./icons";
import { badgeBase } from "./ui";

// ---------- Termômetro de oportunidade (substitui as estrelas) ----------

/** Rótulo por nível (estrelas 1 a 5). */
export const THERMO_LABEL: Record<number, string> = {
  5: "Quente",
  4: "Aquecida",
  3: "Morna",
  2: "Fria",
  1: "Gelada",
};

const FILL: Record<number, string> = {
  5: "bg-[var(--termo-5)]",
  4: "bg-[var(--termo-4)]",
  3: "bg-[var(--termo-3)]",
  2: "bg-[var(--termo-2)]",
  1: "bg-[var(--termo-1)]",
};

const LABEL_COLOR: Record<number, string> = {
  5: "text-amber-glow light:text-accent",
  4: "text-accent",
  3: "text-muted",
  2: "text-subtle",
  1: "text-subtle",
};

export function thermoLevel(stars: number): number {
  return Math.max(0, Math.min(5, Math.round(stars)));
}

export function thermoLabel(stars: number): string {
  return THERMO_LABEL[thermoLevel(stars)] ?? "Não analisada";
}

/** Texto acessível: "Quente, 95 de 100". */
export function thermoText(stars: number, score: number): string {
  const level = thermoLevel(stars);
  return level === 0 ? "Não analisada" : `${THERMO_LABEL[level]}, ${Math.round(score)} de 100`;
}

function Segments({ level, large }: { level: number; large: boolean }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center", large ? "gap-[3px]" : "gap-0.5")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cx(
            large ? "h-2 w-[26px] rounded-[2px]" : "h-1 w-1.5 rounded-[1px]",
            n <= level ? FILL[level] : "bg-[var(--termo-vazio)]",
            n <= level &&
              level === 5 &&
              (large ? "shadow-[var(--brilho-segmento-grande)]" : "shadow-[var(--brilho-segmento)]"),
          )}
        />
      ))}
    </span>
  );
}

/**
 * Barra de 5 segmentos + rótulo + score. Compacto (lista) ou grande (painel).
 * O contêiner é `role="img"` com o texto completo; o texto visível fica oculto do leitor.
 */
export function Thermometer({
  stars,
  score,
  size = "compact",
  hideLabel = false,
  className,
}: {
  stars: number;
  score: number;
  size?: "compact" | "large";
  /** Só a barra e o número (celular). */
  hideLabel?: boolean;
  className?: string;
}) {
  const level = thermoLevel(stars);
  const label = level === 0 ? "Não analisada" : THERMO_LABEL[level];

  if (size === "large") {
    return (
      <div role="img" aria-label={thermoText(stars, score)} className={cx("flex items-end gap-4", className)}>
        <p aria-hidden="true" className="flex items-baseline gap-0.5">
          <span className="font-display text-kpi font-semibold tracking-titulo text-fg tabular-nums">
            {level === 0 ? "—" : Math.round(score)}
          </span>
          <span className="text-legenda text-subtle">/100</span>
        </p>
        <div aria-hidden="true" className="flex flex-col gap-1.5 pb-1">
          <span className={cx("font-display text-h2 font-semibold", LABEL_COLOR[level] ?? "text-subtle")}>
            {label}
          </span>
          <Segments level={level} large />
        </div>
      </div>
    );
  }

  return (
    <span role="img" aria-label={thermoText(stars, score)} className={cx("inline-flex items-center", className)}>
      <Segments level={level} large={false} />
      {!hideLabel && (
        <span aria-hidden="true" className={cx("ml-2 text-legenda font-medium", LABEL_COLOR[level] ?? "text-subtle")}>
          {label}
        </span>
      )}
      {level > 0 && (
        <span aria-hidden="true" className="ml-1.5 font-display text-botao font-semibold text-fg tabular-nums">
          {Math.round(score)}
        </span>
      )}
    </span>
  );
}

// ---------- Monograma da empresa ----------

const IGNORED = new Set(["de", "da", "do", "das", "dos", "e", "d"]);

export function initials(name: string): string {
  const words = name
    .normalize("NFC")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w && !IGNORED.has(w.toLowerCase()));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Iniciais da empresa. Quente: âmbar suave; contatada: anel verde de 2 px (mesma marca do mapa). */
export function Monogram({
  name,
  stars,
  contacted = false,
  size = 40,
}: {
  name: string;
  stars: number;
  contacted?: boolean;
  size?: 32 | 40;
}) {
  const hot = thermoLevel(stars) === 5;
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-display text-botao font-semibold tracking-[.02em]",
        size === 40 ? "size-10 rounded-card" : "size-8 rounded-lg",
        hot ? "bg-amber-soft text-accent" : "bg-selected text-muted",
        contacted && "shadow-[inset_0_0_0_2px_var(--envio-anel)]",
      )}
    >
      {initials(name)}
    </span>
  );
}

// ---------- Situação do site ----------

/** Marca de 8 px ao lado do rótulo: forma diferente por situação, para não depender só de cor. */
export function SiteMark({ status, className }: { status: SiteStatus; className?: string }) {
  const common = cx("size-2 shrink-0", className);
  switch (status) {
    case "NONE":
      return (
        <svg viewBox="0 0 8 8" aria-hidden="true" className={common}>
          <circle cx="4" cy="4" r="3.5" className="fill-amber" />
        </svg>
      );
    case "SOCIAL_ONLY":
      return (
        <svg viewBox="0 0 8 8" aria-hidden="true" className={common}>
          <circle cx="4" cy="4" r="3" fill="none" strokeWidth="1" className="stroke-amber" />
          <path d="M4 1a3 3 0 0 0 0 6z" className="fill-amber" />
        </svg>
      );
    case "OLD":
      return (
        <svg viewBox="0 0 8 8" aria-hidden="true" className={common}>
          <circle cx="4" cy="4" r="3" fill="none" strokeWidth="1.5" className="stroke-amber" />
        </svg>
      );
    case "UNREACHABLE":
      return (
        <svg viewBox="0 0 8 8" aria-hidden="true" className={common}>
          <path d="M4 .5 7.5 4 4 7.5.5 4z" className="fill-pin" />
        </svg>
      );
    case "OK":
      return (
        <svg viewBox="0 0 8 8" aria-hidden="true" className={common}>
          <circle cx="4" cy="4" r="3" fill="none" strokeWidth="1.5" className="stroke-fog" />
        </svg>
      );
    case "UNKNOWN":
      return null;
  }
}

const SITE_TONE: Record<SiteStatus, string> = {
  NONE: "bg-amber-soft text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--letreiro)_35%,transparent)]",
  SOCIAL_ONLY:
    "bg-[color-mix(in_srgb,var(--letreiro)_8%,transparent)] text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--letreiro)_25%,transparent)]",
  OLD: "text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--letreiro)_40%,transparent)]",
  UNREACHABLE: "bg-pin-soft text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--pino)_35%,transparent)]",
  OK: "text-muted shadow-[inset_0_0_0_1px_var(--fio-forte)]",
  UNKNOWN: "border border-dashed border-line-strong text-subtle",
};

export function SiteBadge({ status }: { status: SiteStatus }) {
  return (
    <span className={cx(badgeBase, SITE_TONE[status])}>
      <SiteMark status={status} />
      {SITE_STATUS_LABEL[status]}
    </span>
  );
}

/** Etiqueta "Contatada" (verde): a única etiqueta verde do sistema. */
export function ContactedBadge({ children = "Contatada" }: { children?: ReactNode }) {
  return (
    <span
      className={cx(
        badgeBase,
        "bg-sent-soft text-sent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--envio)_30%,transparent)]",
      )}
    >
      <CheckIcon className="size-3" />
      {children}
    </span>
  );
}

// ---------- Contatos ----------

function ContactLink({
  href,
  label,
  external = false,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={external ? `${label} (abre em nova aba)` : label}
      title={label}
      className="alvo inline-flex size-7 items-center justify-center rounded-control text-muted transicao hover:bg-hover hover:text-fg"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

/** Ícones de ligar, e-mail, WhatsApp sem mensagem e Instagram. WhatsApp só quando confirmado. */
export function ContactIcons({ lead }: { lead: LeadDTO }) {
  const hasAny = lead.whatsapp || lead.phone || lead.email || lead.instagram;
  if (!hasAny) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {lead.whatsapp && (
        <ContactLink href={whatsappUrl(lead.whatsapp)} label="Abrir conversa no WhatsApp sem mensagem" external>
          <WhatsappIcon />
        </ContactLink>
      )}
      {lead.phone && (
        <ContactLink
          href={`tel:${lead.phone}`}
          label={lead.phoneIsMobile ? `Ligar para o celular ${lead.phone}` : `Ligar para ${lead.phone}`}
        >
          <PhoneIcon />
        </ContactLink>
      )}
      {lead.email && (
        <ContactLink href={`mailto:${lead.email}`} label={`Escrever para ${lead.email}`}>
          <MailIcon />
        </ContactLink>
      )}
      {lead.instagram && (
        <ContactLink href={instagramUrl(lead.instagram)} label="Abrir Instagram" external>
          <InstagramIcon />
        </ContactLink>
      )}
    </span>
  );
}
