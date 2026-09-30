"use client";

import { useState, type ReactNode } from "react";
import { deleteLead, errorMessage, saveLeadNotes } from "@/lib/api";
import type { LeadDTO, OutreachSettings } from "@/lib/contract";
import { formatDateTime, formatNumber, formatRating, externalUrl, hostOf, instagramUrl } from "@/lib/format";
import { ExternalIcon, MapPinIcon } from "../icons";
import { SiteBadge, Stars } from "../lead-ui";
import { Modal } from "../modal";
import { OutreachBlock } from "../outreach";
import { Badge, Button, inputClass } from "../ui";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline"
    >
      {children}
      <ExternalIcon className="size-3" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
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
      <label htmlFor="lead-notes" className="mb-1 block text-xs font-medium text-muted">
        Observações
      </label>
      <textarea
        id="lead-notes"
        value={value}
        maxLength={2000}
        rows={4}
        onChange={(event) => {
          setValue(event.target.value);
          if (state !== "idle") setState("idle");
        }}
        onBlur={save}
        placeholder="Anote o que falou com a empresa, próximos passos…"
        className={`${inputClass} h-auto min-h-24 py-2`}
      />
      <p className="mt-1 min-h-5 text-xs" aria-live="polite">
        {state === "saving" && <span className="text-muted">Salvando…</span>}
        {state === "saved" && <span className="text-accent">Salvo</span>}
        {state === "error" && <span className="text-danger">{error}</span>}
      </p>
    </div>
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
    <div className="rounded-md border border-danger/40 p-3">
      <p className="font-medium">Excluir {lead.name}?</p>
      <p className="mt-0.5 text-xs text-muted">
        A empresa sai da lista e não volta em novas pesquisas.
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="danger-solid" size="sm" onClick={remove} disabled={busy}>
          {busy ? "Excluindo…" : "Sim, excluir"}
        </Button>
        <Button size="sm" onClick={() => setConfirming(false)} disabled={busy}>
          Cancelar
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function LeadDrawer({
  lead,
  settings,
  settingsError,
  onClose,
  onUpdated,
  onDeleted,
}: {
  lead: LeadDTO;
  settings: OutreachSettings | undefined;
  settingsError: string | null;
  onClose: () => void;
  onUpdated: (lead: LeadDTO) => void;
  onDeleted: (lead: LeadDTO) => void;
}) {
  const place = [lead.address, lead.neighborhood, [lead.city, lead.state].filter(Boolean).join("/"), lead.postalCode]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal title={lead.name} variant="drawer" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Stars value={lead.stars} />
          <SiteBadge status={lead.siteStatus} />
          {lead.category && <Badge>{lead.category}</Badge>}
        </div>

        <OutreachBlock lead={lead} settings={settings} settingsError={settingsError} onUpdated={onUpdated} />

        <section aria-labelledby="motivos">
          <h3 id="motivos" className="mb-1 text-xs font-semibold text-muted uppercase">
            Por que é uma oportunidade
          </h3>
          {lead.scoreReasons.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4">
              {lead.scoreReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Sem motivos registrados.</p>
          )}
        </section>

        <section aria-labelledby="dados">
          <h3 id="dados" className="mb-1 text-xs font-semibold text-muted uppercase">
            Dados
          </h3>
          <dl className="divide-y divide-line">
            <Row label="Endereço">
              {place || "—"}
              {lead.mapsUrl && (
                <>
                  {" "}
                  <ExtLink href={lead.mapsUrl}>
                    <MapPinIcon className="size-3" />
                    Maps
                  </ExtLink>
                </>
              )}
            </Row>
            <Row label="Nota">
              {lead.rating !== null
                ? `${formatRating(lead.rating)}${lead.reviewCount !== null ? ` (${formatNumber(lead.reviewCount)} avaliações)` : ""}`
                : "Sem avaliações"}
            </Row>
            <Row label="Horário">{lead.openingHours ?? "—"}</Row>
            <Row label="Situação">{lead.businessStatus ?? "—"}</Row>
            <Row label="Responsável">{lead.ownerName ?? "—"}</Row>
            <Row label="Telefone">
              {lead.phone ? (
                <>
                  <a href={`tel:${lead.phone}`} className="hover:underline">
                    {lead.phone}
                  </a>
                  {lead.phoneIsMobile && (
                    <>
                      {" "}
                      <Badge>Celular</Badge>
                    </>
                  )}
                </>
              ) : (
                "—"
              )}
            </Row>
            <Row label="WhatsApp">{lead.whatsapp ?? "Não confirmado"}</Row>
            <Row label="E-mail">
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="hover:underline">
                  {lead.email}
                </a>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Site">
              {lead.website ? <ExtLink href={externalUrl(lead.website)}>{hostOf(lead.website)}</ExtLink> : "Não tem"}
            </Row>
            <Row label="Plataforma">{lead.sitePlatform ?? "—"}</Row>
            <Row label="Sinais do site">
              {lead.siteSignals.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {lead.siteSignals.map((signal) => (
                    <Badge key={signal}>{signal}</Badge>
                  ))}
                </span>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Redes">
              {lead.instagram || lead.facebook || lead.linkedin || lead.tiktok ? (
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {lead.instagram && <ExtLink href={instagramUrl(lead.instagram)}>Instagram</ExtLink>}
                  {lead.facebook && <ExtLink href={externalUrl(lead.facebook)}>Facebook</ExtLink>}
                  {lead.linkedin && <ExtLink href={externalUrl(lead.linkedin)}>LinkedIn</ExtLink>}
                  {lead.tiktok && <ExtLink href={externalUrl(lead.tiktok)}>TikTok</ExtLink>}
                </span>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Origem">{lead.source === "google" ? "Google" : "OpenStreetMap"}</Row>
            <Row label="Atualizada em">{formatDateTime(lead.updatedAt)}</Row>
          </dl>
        </section>

        <Notes lead={lead} onSaved={onUpdated} />

        <div className="border-t border-line pt-4">
          <DeleteLead lead={lead} onDeleted={() => onDeleted(lead)} />
        </div>
      </div>
    </Modal>
  );
}
