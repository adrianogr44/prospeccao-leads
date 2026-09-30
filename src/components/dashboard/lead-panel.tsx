"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { deleteLead, errorMessage, saveLeadNotes } from "@/lib/api";
import { SITE_STATUS_LABEL, type LeadDTO, type OutreachSettings } from "@/lib/contract";
import { cx } from "@/lib/cx";
import {
  externalUrl,
  formatDateTime,
  formatDayMonth,
  formatNumber,
  formatPhone,
  formatRating,
  formatTime,
  hostOf,
  instagramUrl,
} from "@/lib/format";
import { buildOutreachMessage, outreachTarget, outreachUrl } from "@/lib/outreach";
import { useMediaQuery } from "@/lib/use-client-state";
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  ExternalIcon,
  MapPinIcon,
} from "../icons";
import { ContactedBadge, ContactIcons, Monogram, SiteBadge, Thermometer } from "../lead-ui";
import { GoogleSearchLink, linkTarget, sendLabel, SendIcon, sendVariant, WhatsappField } from "../outreach";
import { Badge, Button, buttonStyles, IconButton, Skeleton, textareaClass } from "../ui";

export type PanelFocus = "message" | "whatsapp" | "heading" | null;

// ---------- Blocos ----------

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line-soft pt-5 first:border-t-0 first:pt-0">
      <h3 id={id} className="rotulo mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-fg underline decoration-line-strong underline-offset-2 transicao hover:decoration-fg"
    >
      {children}
      <ExternalIcon className="size-3 text-subtle" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

function Reasons({ lead }: { lead: LeadDTO }) {
  return (
    <div className="space-y-3">
      <Thermometer stars={lead.stars} score={lead.score} size="large" />
      {lead.scoreReasons.length > 0 && (
        <ul className="space-y-1">
          {lead.scoreReasons.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-subtle" />
              {reason}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SiteBadge status={lead.siteStatus} />
        {lead.sitePlatform && <span className="text-legenda text-subtle">{lead.sitePlatform}</span>}
        {lead.website ? (
          <ExtLink href={externalUrl(lead.website)}>Abrir site</ExtLink>
        ) : (
          <GoogleSearchLink lead={lead} />
        )}
      </div>
      {lead.siteSignals.length > 0 && (
        <ul aria-label="Sinais do site" className="flex flex-wrap gap-1">
          {lead.siteSignals.map((signal) => (
            <li key={signal}>
              <Badge>{signal}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Destination({
  lead,
  onUpdated,
  autoFocusField,
}: {
  lead: LeadDTO;
  onUpdated: (lead: LeadDTO) => void;
  autoFocusField: boolean;
}) {
  const target = outreachTarget(lead);
  const [editing, setEditing] = useState(false);

  if (target.kind === "none") {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-muted">
          <AlertIcon className="mt-0.5 size-4 shrink-0 text-warn" />
          Sem contato publicado. Informe o WhatsApp para liberar o envio.
        </p>
        <WhatsappField
          key={lead.whatsapp ?? ""}
          lead={lead}
          onUpdated={onUpdated}
          autoFocusField={autoFocusField}
        />
      </div>
    );
  }

  const line =
    target.kind === "email"
      ? { value: target.email, note: "Por e-mail" }
      : target.confirmed
        ? { value: formatPhone(target.number), note: "WhatsApp confirmado" }
        : target.landline
          ? {
              value: formatPhone(target.number),
              note: "Telefone fixo; só funciona se a empresa usar esse número no WhatsApp.",
            }
          : { value: formatPhone(target.number), note: "Celular; o WhatsApp não foi confirmado." };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0">
          <span className="font-display text-numero font-semibold text-fg tabular-nums">{line.value}</span>
          <span className="block text-legenda text-muted">{line.note}</span>
        </p>
        <ContactIcons lead={lead} />
      </div>
      {editing ? (
        <WhatsappField key={lead.whatsapp ?? ""} lead={lead} onUpdated={onUpdated} onCancel={() => setEditing(false)} />
      ) : (
        <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setEditing(true)}>
          {lead.whatsapp ? "Trocar número" : "Informar WhatsApp"}
        </Button>
      )}
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function Notes({ lead, onSaved }: { lead: LeadDTO; onSaved: (lead: LeadDTO) => void }) {
  const [value, setValue] = useState(lead.notes ?? "");
  const [saved, setSaved] = useState(lead.notes ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (value === saved) return;
    setState("saving");
    setError(null);
    try {
      const updated = await saveLeadNotes(lead.id, value.trim() === "" ? null : value);
      setSaved(value);
      setState("saved");
      onSaved(updated);
    } catch (e) {
      setState("error");
      setError(errorMessage(e));
    }
  }

  return (
    <div>
      <label htmlFor="lead-notes" className="sr-only">
        Observações
      </label>
      <textarea
        id="lead-notes"
        value={value}
        maxLength={2000}
        rows={3}
        aria-keyshortcuts="N"
        onChange={(event) => {
          setValue(event.target.value);
          if (state !== "idle") setState("idle");
        }}
        onBlur={save}
        placeholder="Anote o que falou com a empresa, próximos passos…"
        className={cx(textareaClass, "min-h-[84px]")}
      />
      <div className="mt-1 flex min-h-6 items-center gap-2 text-legenda" aria-live="polite">
        {state === "saving" && <span className="text-subtle">Salvando…</span>}
        {state === "saved" && (
          <span className="inline-flex items-center gap-1 text-muted">
            <CheckIcon className="size-3.5" />
            Salvo
          </span>
        )}
        {state === "error" && (
          <>
            <span className="text-danger">Não consegui salvar a observação.</span>
            <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={save}>
              Tentar de novo
            </Button>
            {error && <span className="sr-only">{error}</span>}
          </>
        )}
      </div>
    </div>
  );
}

function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-1.5">
      <dt className="text-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </div>
  );
}

function Data({ lead }: { lead: LeadDTO }) {
  const place = [lead.address, lead.neighborhood, [lead.city, lead.state].filter(Boolean).join("/"), lead.postalCode]
    .filter(Boolean)
    .join(" · ");
  const socials = [
    lead.instagram && { label: "Instagram", href: instagramUrl(lead.instagram) },
    lead.facebook && { label: "Facebook", href: externalUrl(lead.facebook) },
    lead.linkedin && { label: "LinkedIn", href: externalUrl(lead.linkedin) },
    lead.tiktok && { label: "TikTok", href: externalUrl(lead.tiktok) },
  ].filter((s): s is { label: string; href: string } => Boolean(s));

  return (
    <dl className="divide-y divide-line-soft">
      {(place || lead.mapsUrl) && (
        <DataRow label="Endereço">
          {place}
          {lead.mapsUrl && (
            <>
              {place && " "}
              <ExtLink href={lead.mapsUrl}>
                <MapPinIcon className="size-3" />
                Maps
              </ExtLink>
            </>
          )}
        </DataRow>
      )}
      {lead.category && <DataRow label="Categoria">{lead.category}</DataRow>}
      {lead.rating !== null && (
        <DataRow label="Nota">
          {formatRating(lead.rating)}
          {lead.reviewCount !== null && ` (${formatNumber(lead.reviewCount)} avaliações)`}
        </DataRow>
      )}
      {lead.openingHours && <DataRow label="Horário">{lead.openingHours}</DataRow>}
      {lead.businessStatus && <DataRow label="Situação">{lead.businessStatus}</DataRow>}
      {lead.ownerName && <DataRow label="Responsável">{lead.ownerName}</DataRow>}
      <DataRow label="Telefone">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="hover:underline">
            {formatPhone(lead.phone)}
            {lead.phoneIsMobile && <span className="text-subtle"> · celular</span>}
          </a>
        ) : (
          <span className="text-muted">Não tem</span>
        )}
      </DataRow>
      <DataRow label="WhatsApp">
        {lead.whatsapp ? formatPhone(lead.whatsapp) : <span className="text-muted">Não confirmado</span>}
      </DataRow>
      <DataRow label="E-mail">
        {lead.email ? (
          <a href={`mailto:${lead.email}`} className="hover:underline">
            {lead.email}
          </a>
        ) : (
          <span className="text-muted">Não tem</span>
        )}
      </DataRow>
      <DataRow label="Site">
        {lead.website ? (
          <ExtLink href={externalUrl(lead.website)}>{hostOf(lead.website)}</ExtLink>
        ) : (
          <span className="text-muted">Não tem</span>
        )}
      </DataRow>
      {lead.sitePlatform && <DataRow label="Plataforma">{lead.sitePlatform}</DataRow>}
      {socials.length > 0 && (
        <DataRow label="Redes">
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {socials.map((s) => (
              <ExtLink key={s.label} href={s.href}>
                {s.label}
              </ExtLink>
            ))}
          </span>
        </DataRow>
      )}
      <DataRow label="Origem">{lead.source === "google" ? "Google" : "OpenStreetMap"}</DataRow>
      <DataRow label="Atualizada em">{formatDateTime(lead.updatedAt)}</DataRow>
    </dl>
  );
}

function DeleteLead({ lead, onDeleted }: { lead: LeadDTO; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteLead(lead.id);
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Excluir empresa
      </Button>
    );
  }
  return (
    <div className="rounded-card bg-pin-soft p-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--pino)_35%,transparent)]">
      <p className="font-semibold text-fg">Excluir {lead.name}?</p>
      <p className="mt-0.5 text-muted">A empresa sai da lista e não volta em novas pesquisas.</p>
      <div className="mt-3 flex gap-2">
        <Button variant="danger-solid" size="sm" onClick={remove} loading={busy}>
          Sim, excluir
        </Button>
        <Button size="sm" onClick={() => setConfirming(false)} disabled={busy}>
          Cancelar
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-legenda text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------- Conteúdo por empresa (remonta ao trocar de empresa) ----------

interface ContentProps {
  lead: LeadDTO;
  settings: OutreachSettings | undefined;
  settingsError: string | null;
  onRetrySettings: () => void;
  focus: PanelFocus;
  sentAt: string | null;
  sendError: string | null;
  onUpdated: (lead: LeadDTO) => void;
  onDeleted: (lead: LeadDTO) => void;
  onSend: (lead: LeadDTO) => void;
  onRetryMark: (lead: LeadDTO) => void;
  onUnmark: (lead: LeadDTO) => void;
  onNextQueued: () => void;
  headingId: string;
}

/** Foca o botão "Próxima empresa" quando a barra muda para "Enviada". Identidade estável: roda só na montagem. */
function focusOnMount(node: HTMLElement | null) {
  node?.focus();
}

function PanelContent({
  lead,
  settings,
  settingsError,
  onRetrySettings,
  focus,
  sentAt,
  sendError,
  onUpdated,
  onDeleted,
  onSend,
  onRetryMark,
  onUnmark,
  onNextQueued,
  headingId,
}: ContentProps) {
  // Texto editado só vale para este envio; sem edição, acompanha as configurações.
  const [edited, setEdited] = useState<string | null>(null);
  const [copy, setCopy] = useState<"idle" | "done" | "error">("idle");
  const wide = useMediaQuery("(min-width: 768px)", true);
  const [dataOpen, setDataOpen] = useState(wide);
  const root = useRef<HTMLDivElement>(null);

  // O conteúdo remonta a cada abertura pedida, então isto roda uma vez por pedido de foco.
  useEffect(() => {
    const el = root.current;
    if (!el || !focus) return;
    const selector =
      focus === "message" ? "#outreach-message" : focus === "whatsapp" ? "#outreach-whatsapp" : `#${headingId}`;
    (el.querySelector<HTMLElement>(selector) ?? document.getElementById(headingId))?.focus();
  }, [focus, headingId]);

  const target = outreachTarget(lead);
  const generated = settings ? buildOutreachMessage(lead, settings) : "";
  const message = edited ?? generated;
  const url = settings ? outreachUrl(lead, message) : null;
  const label = sendLabel(target);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopy("done");
    } catch {
      setCopy("error");
    }
  }

  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <Block id="bloco-motivos" title="Por que abordar">
          <Reasons lead={lead} />
        </Block>

        <Block id="bloco-para" title="Para">
          <Destination lead={lead} onUpdated={onUpdated} autoFocusField={focus === "whatsapp"} />
        </Block>

        <Block id="bloco-mensagem" title="Mensagem">
          {!settings ? (
            settingsError ? (
              <div role="alert" className="space-y-2">
                <p className="text-fg">Não consegui carregar a mensagem.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={onRetrySettings}>
                    Tentar de novo
                  </Button>
                  <a href="/configuracoes" className={buttonStyles("ghost", "sm")}>
                    Abrir Configurações
                  </a>
                </div>
              </div>
            ) : (
              <div role="status" className="space-y-2">
                <span className="sr-only">Carregando a mensagem…</span>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            )
          ) : (
            <div>
              <label htmlFor="outreach-message" className="sr-only">
                Mensagem (você pode editar antes de enviar)
              </label>
              <textarea
                id="outreach-message"
                data-autofocus={focus === "message" ? "" : undefined}
                value={message}
                rows={10}
                onChange={(event) => {
                  setEdited(event.target.value);
                  setCopy("idle");
                }}
                className={cx(textareaClass, "max-h-[300px] min-h-[220px] [field-sizing:content]")}
              />
              {edited !== null && edited !== generated && (
                <Button size="sm" variant="ghost" className="mt-1 -ml-3" onClick={() => setEdited(null)}>
                  Voltar à mensagem padrão
                </Button>
              )}
            </div>
          )}
        </Block>

        <Block id="bloco-notas" title="Observações">
          <Notes key={lead.id} lead={lead} onSaved={onUpdated} />
        </Block>

        <section aria-labelledby="bloco-dados" className="border-t border-line-soft pt-5">
          <h3 id="bloco-dados">
            <button
              type="button"
              aria-expanded={dataOpen}
              aria-controls="dados-conteudo"
              onClick={() => setDataOpen((v) => !v)}
              className="rotulo -mx-1 inline-flex items-center gap-1 rounded-control px-1 transicao hover:text-fg"
            >
              Dados
              <ChevronDownIcon className={cx("size-3.5 transition-transform", dataOpen && "rotate-180")} />
            </button>
          </h3>
          <div id="dados-conteudo" hidden={!dataOpen} className="mt-2">
            <Data lead={lead} />
          </div>
        </section>

        <div className="border-t border-line-soft pt-5">
          <DeleteLead lead={lead} onDeleted={() => onDeleted(lead)} />
        </div>
      </div>

      {/* Barra de envio: fixa no pé do painel */}
      <div className="shrink-0 border-t border-line bg-inherit px-5 py-3">
        {sendError && (
          <div role="alert" className="mb-2 flex flex-wrap items-center gap-2 text-legenda">
            <AlertIcon className="size-4 shrink-0 text-danger" />
            <span className="min-w-0 flex-1 text-fg">{sendError}</span>
            <Button size="sm" onClick={() => onRetryMark(lead)}>
              Marcar como contatada
            </Button>
          </div>
        )}
        {sentAt ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button ref={focusOnMount} variant="primary" onClick={onNextQueued}>
              Próxima empresa
              <ChevronRightIcon />
            </Button>
            <Button variant="ghost" onClick={() => onUnmark(lead)}>
              Desmarcar
            </Button>
            <span className="ml-auto inline-flex items-center gap-1 text-legenda text-muted">
              <CheckIcon className="size-3.5" />
              Enviada às {formatTime(sentAt)}
            </span>
          </div>
        ) : !settings ? (
          <Skeleton className="h-9 w-56 rounded-control" />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {url && label ? (
              <a
                href={url}
                {...linkTarget(target)}
                data-send="panel"
                data-lead-id={lead.id}
                aria-keyshortcuts="E"
                className={buttonStyles(sendVariant(lead, target), "md")}
                onClick={() => onSend(lead)}
              >
                <SendIcon target={target} />
                {label}
                {target.kind === "whatsapp" && <span className="sr-only"> (abre em nova aba)</span>}
              </a>
            ) : null}
            <Button
              variant={url ? "secondary" : "primary"}
              data-action="copy"
              aria-keyshortcuts="C"
              onClick={copyMessage}
              icon={<CopyIcon />}
            >
              {url ? <span className="max-sm:sr-only">Copiar</span> : "Copiar mensagem"}
            </Button>
            {lead.contactedAt && (
              <Button variant="ghost" onClick={() => onUnmark(lead)}>
                Desmarcar
              </Button>
            )}
            <span role="status" className="text-legenda text-muted">
              {copy === "done" && (
                <span className="inline-flex items-center gap-1">
                  <CheckIcon className="size-3.5" />
                  Copiado
                </span>
              )}
              {copy === "error" && (
                <span className="text-danger">Não consegui copiar. Selecione o texto e copie com Ctrl+C.</span>
              )}
            </span>
            {!url && <p className="w-full text-legenda text-muted">Informe o WhatsApp para liberar o envio.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Painel ----------

export function LeadPanel({
  lead,
  position,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onClose,
  requestKey,
  ...content
}: Omit<ContentProps, "headingId"> & {
  /** "3 de 36", ou null quando a empresa não está na página atual. */
  position: { index: number; total: number } | null;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** Muda a cada abertura pedida (remonta o conteúdo e aplica o foco pedido). */
  requestKey: number;
}) {
  const headingId = "painel-empresa-titulo";
  const place = [lead.category, [lead.neighborhood, lead.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-line">
        <div className="flex h-11 items-center justify-between gap-2 px-2">
          <Button variant="ghost" size="sm" onClick={onPrev} disabled={!canPrev} aria-keyshortcuts="K">
            <ChevronLeftIcon />
            Anterior
          </Button>
          <span className="text-legenda text-subtle tabular-nums">
            {position ? `${formatNumber(position.index)} de ${formatNumber(position.total)}` : "Fora desta página"}
          </span>
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={onNext} disabled={!canNext} aria-keyshortcuts="J">
              Próxima
              <ChevronRightIcon />
            </Button>
            <IconButton label="Fechar painel" onClick={onClose} aria-keyshortcuts="Escape">
              <CloseIcon />
            </IconButton>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 pt-1 pb-4">
          <Monogram name={lead.name} stars={lead.stars} contacted={lead.contactedAt !== null} />
          <div className="min-w-0 flex-1">
            <h2
              id={headingId}
              tabIndex={-1}
              data-autofocus={content.focus === "message" || content.focus === "whatsapp" ? undefined : ""}
              className="truncate font-display text-h2 font-semibold outline-none"
            >
              {lead.name}
            </h2>
            <p className="truncate text-legenda text-muted">{place || SITE_STATUS_LABEL[lead.siteStatus]}</p>
          </div>
          {lead.contactedAt && <ContactedBadge>Contatada em {formatDayMonth(lead.contactedAt)}</ContactedBadge>}
        </div>
      </div>
      <PanelContent key={`${lead.id}-${requestKey}`} lead={lead} headingId={headingId} {...content} />
    </div>
  );
}
