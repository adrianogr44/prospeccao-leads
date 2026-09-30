"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { errorMessage, exportPath, exportToSheets, type ExportFormat } from "@/lib/api";
import type { LeadFilters, MetaResponse, SheetsExportResponse } from "@/lib/contract";
import { formatNumber } from "@/lib/format";
import { CheckIcon, ChevronDownIcon, DownloadIcon, ExternalIcon } from "../icons";
import { Modal } from "../modal";
import { Button, Field, inputClass } from "../ui";

const FILE_FORMATS: Array<{ format: ExportFormat; label: string }> = [
  { format: "xlsx", label: "Excel (.xlsx)" },
  { format: "csv", label: "CSV (.csv)" },
  { format: "json", label: "JSON (.json)" },
];

const itemClass =
  "flex h-8 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-muted transicao hover:bg-hover hover:text-fg focus-visible:bg-selected focus-visible:text-fg focus-visible:shadow-[inset_0_0_0_2px_var(--fio-foco)] focus-visible:outline-none";

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

  const code = "rounded-badge bg-selected px-1.5 py-0.5 font-mono text-legenda text-fg";

  return (
    <Modal title="Exportar para o Google Sheets" onClose={onClose}>
      {(close) =>
        !configured ? (
          <div className="space-y-4">
            <p>
              A conexão com o Google Sheets ainda não está configurada. Coloque o JSON da conta de serviço do Google na
              variável <code className={code}>GOOGLE_SERVICE_ACCOUNT_JSON</code> do arquivo{" "}
              <code className={code}>.env</code> e reinicie o sistema.
            </p>
            <div className="flex justify-end">
              <Button onClick={close}>Fechar</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <p>
              Compartilhe a planilha, com permissão de editor, com este e-mail:
              <br />
              <code className={`${code} mt-1 inline-block break-all select-all`}>
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
                <p className="flex flex-wrap items-center gap-1.5 text-fg">
                  <CheckIcon className="size-4 text-muted" />
                  {formatNumber(result.rows)} linhas enviadas para a aba “{result.sheetTitle}”.
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
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
              <Button type="submit" variant="primary" loading={busy}>
                Exportar
              </Button>
            </div>
          </form>
        )
      }
    </Modal>
  );
}

/** Menu de exportação: arquivos do filtro atual e Google Sheets. Setas, Home/End e Esc funcionam. */
export function ExportMenu({
  filters,
  meta,
  total,
  compact = false,
}: {
  filters: LeadFilters;
  meta: MetaResponse | undefined;
  total: number | undefined;
  /** Só o ícone (celular). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => items[(i + items.length) % items.length]?.focus();
    if (event.key === "ArrowDown") go(index + 1);
    else if (event.key === "ArrowUp") go(index - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(items.length - 1);
    else if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "Tab") setOpen(false);
    else return;
    if (event.key !== "Tab") event.preventDefault();
  }

  return (
    <div ref={wrapper} className="relative">
      <Button
        ref={trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="menu-exportar"
        aria-label={compact ? "Exportar" : undefined}
        onClick={() => setOpen((v) => !v)}
        className={compact ? "w-9 px-0" : undefined}
        icon={<DownloadIcon />}
      >
        {!compact && (
          <>
            Exportar
            <ChevronDownIcon className="size-3.5 text-subtle" />
          </>
        )}
      </Button>
      {open && (
        <div
          ref={menu}
          id="menu-exportar"
          role="menu"
          aria-label="Exportar"
          onKeyDown={onMenuKey}
          className="anima-menu absolute top-full right-0 z-40 mt-2 w-60 origin-top-right rounded-card bg-surface-3 p-1 shadow-elev-3"
        >
          <p className="px-2.5 pt-1.5 pb-2 text-legenda text-subtle">
            Exporta as {total === undefined ? "" : `${formatNumber(total)} `}empresas do filtro atual
          </p>
          {FILE_FORMATS.map(({ format, label }) => (
            <a
              key={format}
              role="menuitem"
              tabIndex={-1}
              href={exportPath(filters, format)}
              download
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <DownloadIcon className="size-4 text-subtle" />
              {label}
            </a>
          ))}
          <div role="separator" className="mx-1 my-1 h-px bg-line-soft" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={itemClass}
            onClick={() => {
              setOpen(false);
              setSheetsOpen(true);
            }}
          >
            <ExternalIcon className="size-4 text-subtle" />
            Google Sheets…
          </button>
        </div>
      )}
      {sheetsOpen && <SheetsDialog filters={filters} meta={meta} onClose={() => setSheetsOpen(false)} />}
    </div>
  );
}
