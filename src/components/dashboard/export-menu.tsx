"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { errorMessage, exportPath, exportToSheets, type ExportFormat } from "@/lib/api";
import type { LeadFilters, MetaResponse, SheetsExportResponse } from "@/lib/contract";
import { formatNumber } from "@/lib/format";
import { ChevronDownIcon, DownloadIcon, ExternalIcon } from "../icons";
import { Modal } from "../modal";
import { Button, Field, buttonStyles, inputClass } from "../ui";

const FILE_FORMATS: Array<{ format: ExportFormat; label: string }> = [
  { format: "xlsx", label: "Excel (.xlsx)" },
  { format: "csv", label: "CSV (.csv)" },
  { format: "json", label: "JSON (.json)" },
];

const itemClass = "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface";

function SheetsDialog({
  filters,
  meta,
  onClose,
}: {
  filters: LeadFilters;
  meta: MetaResponse | undefined;
  onClose: () => void;
}) {
  const [spreadsheet, setSpreadsheet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SheetsExportResponse | null>(null);
  const configured = meta?.config.googleSheets === true;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (spreadsheet.trim().length < 10) {
      setError("Cole o link completo ou o ID da planilha.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await exportToSheets(spreadsheet.trim(), filters));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Exportar para o Google Sheets" onClose={onClose}>
      {(close) =>
        !configured ? (
          <div className="space-y-3">
            <p>
              A conexão com o Google Sheets ainda não está configurada. Coloque o JSON da conta de serviço do
              Google na variável <code className="rounded bg-surface px-1">GOOGLE_SERVICE_ACCOUNT_JSON</code> do
              arquivo <code className="rounded bg-surface px-1">.env</code> e reinicie o sistema.
            </p>
            <Button onClick={close}>Fechar</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <p>
              Compartilhe a planilha, com permissão de editor, com este e-mail:
              <br />
              <code className="mt-1 inline-block rounded bg-surface px-1.5 py-0.5 break-all select-all">
                {meta?.config.serviceAccountEmail ?? "e-mail da conta de serviço indisponível"}
              </code>
            </p>
            <Field id="sheets-url" label="Link ou ID da planilha" error={error ?? undefined}>
              {(control) => (
                <input
                  {...control}
                  value={spreadsheet}
                  onChange={(event) => setSpreadsheet(event.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  autoComplete="off"
                  className={inputClass}
                />
              )}
            </Field>
            <div aria-live="polite">
              {result && (
                <p className="text-accent">
                  {formatNumber(result.rows)} linhas enviadas para a aba “{result.sheetTitle}”.{" "}
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline"
                  >
                    Abrir planilha
                    <ExternalIcon className="size-3" />
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={close}>Fechar</Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? "Enviando…" : "Exportar"}
              </Button>
            </div>
          </form>
        )
      }
    </Modal>
  );
}

export function ExportMenu({ filters, meta }: { filters: LeadFilters; meta: MetaResponse | undefined }) {
  const [open, setOpen] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="menu-exportar"
        onClick={() => setOpen((v) => !v)}
        className={buttonStyles("secondary")}
      >
        <DownloadIcon />
        Exportar
        <ChevronDownIcon className="size-3.5" />
      </button>
      {open && (
        <ul
          id="menu-exportar"
          className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-line bg-canvas p-1 shadow-sm"
        >
          {FILE_FORMATS.map(({ format, label }) => (
            <li key={format}>
              <a href={exportPath(filters, format)} download onClick={() => setOpen(false)} className={itemClass}>
                {label}
              </a>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                setSheetsOpen(true);
              }}
            >
              Google Sheets…
            </button>
          </li>
        </ul>
      )}
      {sheetsOpen && <SheetsDialog filters={filters} meta={meta} onClose={() => setSheetsOpen(false)} />}
    </div>
  );
}
