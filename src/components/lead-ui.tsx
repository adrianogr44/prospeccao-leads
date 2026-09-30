import type { ReactNode } from "react";
import { SITE_STATUS_LABEL, type LeadDTO, type SiteStatus } from "@/lib/contract";
import { instagramUrl, whatsappUrl } from "@/lib/format";
import { cx } from "@/lib/cx";
import { InstagramIcon, MailIcon, PhoneIcon, StarIcon, WhatsappIcon } from "./icons";
import { Badge, type BadgeTone } from "./ui";

const siteTone: Record<SiteStatus, BadgeTone> = {
  NONE: "accent",
  SOCIAL_ONLY: "accent",
  OLD: "warn",
  UNREACHABLE: "danger",
  OK: "neutral",
  UNKNOWN: "neutral",
};

export function SiteBadge({ status }: { status: SiteStatus }) {
  return <Badge tone={siteTone[status]}>{SITE_STATUS_LABEL[status]}</Badge>;
}

export function Stars({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span role="img" aria-label={`${filled} de 5`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} className={cx("size-3.5", n <= filled ? "text-accent" : "text-line")} />
      ))}
    </span>
  );
}

const iconLink =
  "inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-accent";

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
      aria-label={label}
      title={label}
      className={iconLink}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  );
}

/** Ícones de contato clicáveis. WhatsApp só aparece quando confirmado. */
export function ContactIcons({ lead }: { lead: LeadDTO }) {
  const hasAny = lead.whatsapp || lead.phone || lead.email || lead.instagram;
  if (!hasAny) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {lead.whatsapp && (
        <ContactLink href={whatsappUrl(lead.whatsapp)} label="Abrir WhatsApp" external>
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
        <ContactLink href={`mailto:${lead.email}`} label={`Enviar e-mail para ${lead.email}`}>
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
