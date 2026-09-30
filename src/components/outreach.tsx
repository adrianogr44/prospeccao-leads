"use client";

import { useState, type MouseEvent } from "react";
import { errorMessage, setLeadContacted } from "@/lib/api";
import type { LeadDTO, OutreachSettings } from "@/lib/contract";
import { formatDate } from "@/lib/format";
import { buildOutreachMessage, outreachTarget, outreachUrl, type OutreachTarget } from "@/lib/outreach";
import { CopyIcon, MailIcon, SendIcon, WhatsappIcon } from "./icons";
import { Button, buttonStyles, inputClass } from "./ui";

function sendLabel(target: OutreachTarget): string | null {
  if (target.kind === "whatsapp") {
    if (target.confirmed) return "Enviar proposta no WhatsApp";
    return target.landline ? "Tentar WhatsApp no telefone fixo" : "Tentar WhatsApp no celular";
  }
  return target.kind === "email" ? "Enviar proposta por e-mail" : null;
}

/** WhatsApp abre em nova aba; mailto abre o programa de e-mail sem trocar de página. */
const linkTarget = (target: OutreachTarget) =>
  target.kind === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {};

/** Marca como contatado; falha aqui não impede a conversa já aberta. */
async function markContacted(lead: LeadDTO, onUpdated: (lead: LeadDTO) => void): Promise<string | null> {
  try {
    onUpdated(await setLeadContacted(lead.id, true));
    return null;
  } catch (e) {
    return errorMessage(e);
  }
}

/** Botão de ícone da tabela: abre a conversa com a mensagem padrão e marca como contatado. */
export function ProposalButton({
  lead,
  settings,
  onUpdated,
}: {
  lead: LeadDTO;
  settings: OutreachSettings | undefined;
  onUpdated: (lead: LeadDTO) => void;
}) {
  const target = outreachTarget(lead);
  if (!settings || target.kind === "none") return null;
  const url = outreachUrl(lead, buildOutreachMessage(lead, settings));
  if (!url) return null;
  const label =
    target.kind === "whatsapp" && !target.confirmed
      ? "Enviar proposta (WhatsApp não confirmado)"
      : "Enviar proposta";

  return (
    <a
      href={url}
      {...linkTarget(target)}
      aria-label={label}
      title={label}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-accent"
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        void markContacted(lead, onUpdated);
      }}
    >
      <SendIcon />
    </a>
  );
}

/** Bloco "Abordagem" do painel de detalhe. */
export function OutreachBlock({
  lead,
  settings,
  settingsError,
  onUpdated,
}: {
  lead: LeadDTO;
  settings: OutreachSettings | undefined;
  settingsError: string | null;
  onUpdated: (lead: LeadDTO) => void;
}) {
  // Texto editado só vale para este envio; sem edição, acompanha as configurações.
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const target = outreachTarget(lead);
  const generated = settings ? buildOutreachMessage(lead, settings) : "";
  const message = edited ?? generated;
  const url = settings ? outreachUrl(lead, message) : null;
  const label = sendLabel(target);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setError(null);
    } catch {
      setError("Não consegui copiar. Selecione o texto e copie com Ctrl+C.");
    }
  }

  async function contact(contacted: boolean) {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await setLeadContacted(lead.id, contacted));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="abordagem" className="rounded-lg border border-line bg-surface p-3">
      <h3 id="abordagem" className="mb-2 text-xs font-semibold text-muted uppercase">
        Abordagem
      </h3>

      {!settings ? (
        <p className={settingsError ? "text-danger" : "text-muted"} role={settingsError ? "alert" : "status"}>
          {settingsError ?? "Carregando a mensagem…"}
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="outreach-message" className="mb-1 block text-xs font-medium text-muted">
              Mensagem (você pode editar antes de enviar)
            </label>
            <textarea
              id="outreach-message"
              value={message}
              rows={9}
              onChange={(event) => {
                setEdited(event.target.value);
                setCopied(false);
              }}
              className={`${inputClass} h-auto min-h-40 py-2`}
            />
            {edited !== null && edited !== generated && (
              <Button size="sm" variant="ghost" className="mt-1" onClick={() => setEdited(null)}>
                Voltar à mensagem padrão
              </Button>
            )}
          </div>

          {target.kind === "whatsapp" && !target.confirmed && (
            <p className="text-warn">
              {target.landline
                ? "Telefone fixo; só funciona se a empresa usar esse número no WhatsApp."
                : "Número de celular; o WhatsApp não foi confirmado."}
            </p>
          )}
          {target.kind === "none" && <p className="text-muted">Esta empresa não tem contato publicado.</p>}

          <div className="flex flex-wrap items-center gap-2">
            {url && label && (
              <a
                href={url}
                {...linkTarget(target)}
                className={buttonStyles("primary")}
                onClick={() => {
                  void markContacted(lead, onUpdated).then((failure) => failure && setError(failure));
                }}
              >
                {target.kind === "email" ? <MailIcon /> : <WhatsappIcon />}
                {label}
                {target.kind === "whatsapp" && <span className="sr-only">(abre em nova aba)</span>}
              </a>
            )}
            <Button variant={url ? "secondary" : "primary"} onClick={copy}>
              <CopyIcon />
              Copiar mensagem
            </Button>
            <span className="text-xs text-accent" role="status">
              {copied ? "Copiado" : ""}
            </span>
          </div>

          {lead.contactedAt && (
            <p className="flex flex-wrap items-center gap-2 text-muted">
              Contatado em {formatDate(lead.contactedAt)}
              <Button size="sm" variant="ghost" onClick={() => contact(false)} disabled={busy}>
                Desmarcar
              </Button>
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
