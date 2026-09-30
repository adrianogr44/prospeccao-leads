"use client";

import { useState, type MouseEvent } from "react";
import { errorMessage, saveLeadWhatsapp } from "@/lib/api";
import { isPhoneWithAreaCode, PHONE_FORMAT_MESSAGE, type LeadDTO, type OutreachSettings } from "@/lib/contract";
import { cx } from "@/lib/cx";
import { onlyDigits } from "@/lib/format";
import { buildOutreachMessage, outreachTarget, outreachUrl, type OutreachTarget } from "@/lib/outreach";
import { ExternalIcon, MailIcon, PlusIcon, RefreshIcon, WhatsappIcon } from "./icons";
import { Button, buttonStyles, inputClass, labelClass, Skeleton, type ButtonVariant } from "./ui";

/** Rótulo completo do envio (painel). */
export function sendLabel(target: OutreachTarget): string | null {
  if (target.kind === "whatsapp") {
    if (target.confirmed) return "Enviar proposta no WhatsApp";
    return target.landline ? "Tentar WhatsApp no telefone fixo" : "Tentar WhatsApp no celular";
  }
  return target.kind === "email" ? "Enviar proposta por e-mail" : null;
}

/** Rótulo curto da lista; o completo vai no title. */
function shortLabel(target: OutreachTarget): string {
  if (target.kind === "email") return "Enviar e-mail";
  return target.kind === "whatsapp" && target.confirmed ? "Enviar proposta" : "Tentar WhatsApp";
}

/**
 * Nome acessível do botão da linha. Leva a empresa: 36 links "Enviar proposta" iguais não dizem nada ao leitor de tela.
 * Começa pelo texto visível ("Enviar proposta", "Tentar WhatsApp", "Enviar e-mail", "Reenviar").
 */
export function rowSendLabel(lead: Pick<LeadDTO, "name">, target: OutreachTarget, contacted: boolean): string | null {
  if (target.kind === "none") return null;
  if (target.kind === "email") {
    return contacted ? `Reenviar proposta para ${lead.name} por e-mail` : `Enviar e-mail para ${lead.name}`;
  }
  const newTab = " (abre em nova aba)";
  if (contacted) return `Reenviar proposta para ${lead.name} no WhatsApp${newTab}`;
  if (target.confirmed) return `Enviar proposta para ${lead.name} no WhatsApp${newTab}`;
  return `Tentar WhatsApp para ${lead.name}, ${target.landline ? "telefone fixo" : "celular"}${newTab}`;
}

/** WhatsApp abre em nova aba; mailto abre o programa de e-mail sem trocar de página. */
export const linkTarget = (target: OutreachTarget) =>
  target.kind === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {};

/** Verde só com WhatsApp confirmado e ainda não contatada (regra de uma cor verde por linha). */
export function sendVariant(lead: LeadDTO, target: OutreachTarget): ButtonVariant {
  return target.kind === "whatsapp" && target.confirmed && !lead.contactedAt ? "send" : "secondary";
}

export const SendIcon = ({ target }: { target: OutreachTarget }) =>
  target.kind === "email" ? <MailIcon /> : <WhatsappIcon />;

/**
 * Botão de proposta da linha: abre a conversa com a mensagem padrão e avisa o dashboard (`onSend`),
 * que marca como contatada. Sem contato, abre o painel com o campo de WhatsApp em foco.
 * `compact`: só ícone, 44 × 44 (celular).
 */
export function ProposalButton({
  lead,
  settings,
  onSend,
  onAddWhatsapp,
  compact = false,
  tabIndex,
}: {
  lead: LeadDTO;
  settings: OutreachSettings | undefined;
  onSend: (lead: LeadDTO) => void;
  onAddWhatsapp: (lead: LeadDTO) => void;
  compact?: boolean;
  tabIndex?: number;
}) {
  if (!settings) {
    return <Skeleton className={compact ? "size-11 rounded-control" : "h-8 w-36 rounded-control"} />;
  }
  const target = outreachTarget(lead);
  const url = outreachUrl(lead, buildOutreachMessage(lead, settings));
  const size = compact ? "touch" : "sm";

  if (!url || target.kind === "none") {
    return (
      <button
        type="button"
        tabIndex={tabIndex}
        title="Sem contato publicado. Informe o WhatsApp para enviar a proposta."
        aria-label={`Adicionar WhatsApp de ${lead.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onAddWhatsapp(lead);
        }}
        className={buttonStyles("ghost", size)}
      >
        <PlusIcon />
        {!compact && "Adicionar WhatsApp"}
      </button>
    );
  }

  const contacted = lead.contactedAt !== null;
  const text = contacted ? "Reenviar" : shortLabel(target);
  return (
    <a
      href={url}
      {...linkTarget(target)}
      tabIndex={tabIndex}
      data-send="row"
      data-lead-id={lead.id}
      title={sendLabel(target) ?? undefined}
      aria-label={rowSendLabel(lead, target, contacted) ?? undefined}
      className={buttonStyles(sendVariant(lead, target), size)}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onSend(lead);
      }}
    >
      {contacted ? <RefreshIcon /> : <SendIcon target={target} />}
      {!compact && text}
    </a>
  );
}

/** Busca no Google pelo WhatsApp da empresa. */
export function googleSearchUrl(lead: Pick<LeadDTO, "name" | "city">): string {
  return `https://www.google.com/search?q=${encodeURIComponent([lead.name, lead.city, "whatsapp"].filter(Boolean).join(" "))}`;
}

export function GoogleSearchLink({ lead, className }: { lead: LeadDTO; className?: string }) {
  return (
    <a
      href={googleSearchUrl(lead)}
      target="_blank"
      rel="noopener noreferrer"
      className={cx("inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-fg hover:underline", className)}
    >
      Procurar no Google
      <ExternalIcon className="size-3" />
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

/** Número informado à mão, para empresas sem WhatsApp publicado. Remonta quando o número salvo muda. */
export function WhatsappField({
  lead,
  onUpdated,
  onCancel,
  autoFocusField = false,
}: {
  lead: LeadDTO;
  onUpdated: (lead: LeadDTO) => void;
  /** Quando existe, mostra "Cancelar" (campo aberto por "Trocar número"). */
  onCancel?: () => void;
  /** Marca o campo para receber o foco quando a folha abre ("Adicionar WhatsApp"). */
  autoFocusField?: boolean;
}) {
  const [value, setValue] = useState(lead.whatsapp ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typed = value.trim();
  const changed = onlyDigits(typed) !== (lead.whatsapp ?? "");

  async function save() {
    if (typed && !isPhoneWithAreaCode(typed)) {
      setError(PHONE_FORMAT_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onUpdated(await saveLeadWhatsapp(lead.id, typed || null));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor="outreach-whatsapp" className={labelClass}>
        WhatsApp da empresa
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="outreach-whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={value}
          data-autofocus={autoFocusField ? "" : undefined}
          data-dirty={changed ? "true" : undefined}
          placeholder="(19) 99999-8888"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "outreach-whatsapp-error" : "outreach-whatsapp-hint"}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && changed) void save();
          }}
          className={cx(inputClass, "w-48 flex-1 max-md:h-11")}
        />
        <Button className="max-md:h-11" onClick={save} disabled={!changed} loading={busy}>
          Salvar número
        </Button>
        {onCancel && (
          <Button variant="ghost" className="max-md:h-11" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
      {error ? (
        <p id="outreach-whatsapp-error" role="alert" className="mt-1 text-legenda text-danger">
          {error}
        </p>
      ) : (
        <p id="outreach-whatsapp-hint" className="mt-1 text-legenda text-subtle">
          {lead.whatsapp ? "Número usado no envio." : "Cole aqui o número que você encontrar."}{" "}
          <GoogleSearchLink lead={lead} />
        </p>
      )}
    </div>
  );
}
