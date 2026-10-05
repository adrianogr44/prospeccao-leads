"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { actOnCnpjImport, cnpjPath, createCnpjImport, errorMessage, metaPath } from "@/lib/api";
import {
  CNPJ_DUMP_PARTS,
  CNPJ_IMPORT_STAGE_LABEL,
  cnpjImportInputSchema,
  type CnpjImportDTO,
  type CnpjStatusResponse,
  type MetaResponse,
  type SearchStatus,
} from "@/lib/contract";
import { cx } from "@/lib/cx";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useApiGet } from "@/lib/use-api";
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DatabaseIcon,
  PauseIcon,
  PlayIcon,
  SpinnerIcon,
} from "../icons";
import { fieldErrors, focusFirstError, readForm, type FieldErrors } from "../search-fields";
import {
  Badge,
  Button,
  buttonStyles,
  cardStyles,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  formGridClass,
  inputClass,
  Notice,
  panelClass,
  ProgressBar,
  Section,
  Skeleton,
  type BadgeTone,
  type ProgressState,
} from "../ui";

const STATUS_LABEL: Record<SearchStatus, string> = {
  queued: "Na fila",
  running: "Em andamento",
  paused: "Pausada",
  done: "Concluída",
  failed: "Falhou",
};

const STATUS_TONE: Record<SearchStatus, BadgeTone> = {
  queued: "neutral",
  running: "neutral",
  paused: "neutral",
  done: "neutral",
  failed: "danger",
};

const STATUS_ICON: Record<SearchStatus, ReactNode> = {
  queued: null,
  running: <SpinnerIcon className="size-3" />,
  paused: <PauseIcon className="size-3" />,
  done: <CheckIcon className="size-3" />,
  failed: <AlertIcon className="size-3" />,
};

const isActive = (i: CnpjImportDTO) => i.status === "queued" || i.status === "running";

/** "09/2026" a partir de "2026-09" (o DTO guarda o mês, não uma data). */
function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  return year && m ? `${m}/${year}` : month;
}

const placeOf = (i: CnpjImportDTO) =>
  i.cities.map((c) => [c.city, c.state].filter(Boolean).join("/")).join(", ") || "sem cidade";

function statusAnnouncement(job: CnpjImportDTO): string | null {
  switch (job.status) {
    case "done":
      return `Importação concluída: ${formatNumber(job.phoneCount)} empresas ganharam telefone e ${formatNumber(job.emailCount)} ganharam e-mail.`;
    case "failed":
      return "A importação da base de CNPJ falhou.";
    case "paused":
      return "Importação pausada.";
    default:
      return null;
  }
}

// ---------- Situação da base local ----------

function BaseStatus({ status }: { status: CnpjStatusResponse | undefined }) {
  if (!status) {
    return <Skeleton className="h-24 w-full rounded-panel" />;
  }

  const stats: Array<[string, string]> = [
    ["Estabelecimentos ativos", formatNumber(status.establishments)],
    ["Mês do dump", status.dumpMonth ? monthLabel(status.dumpMonth) : "nenhum"],
    ["Empresas com contato da Receita", formatNumber(status.enrichedLeads)],
  ];

  return (
    <div className={cx(panelClass, "p-5")}>
      {status.establishments === 0 ? (
        // Critério 8: sem o dump importado o sistema funciona como hoje e a tela explica o que fazer.
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-muted">
            <DatabaseIcon className="mt-0.5 size-4 shrink-0 text-subtle" />
            A base de CNPJ ainda não foi importada. O dashboard funciona normalmente; só não há telefone nem
            e-mail vindos da Receita.
          </p>
          <p className="text-legenda text-subtle">
            Preencha a cidade ao lado e comece a importação. O dump do mês tem alguns gigabytes e é lido em
            fluxo: nada do arquivo fica guardado, só as empresas dos municípios pedidos. Para experimentar
            rápido, marque “Ler só uma parte do dump”.
          </p>
        </div>
      ) : (
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-legenda text-subtle">{label}</dt>
              <dd className="font-display text-kpi font-semibold text-fg tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ---------- Formulário ----------

function NewImportForm({
  meta,
  hasBase,
  onCreated,
}: {
  meta: MetaResponse | undefined;
  /** A base local já tem estabelecimentos: dá para cruzar de novo sem baixar nada. */
  hasBase: boolean;
  onCreated: (job: CnpjImportDTO) => void;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(true);
  const [skipDump, setSkipDump] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const raw = readForm(form);
    const parsed = cnpjImportInputSchema.safeParse({
      cities: [{ city: raw.city ?? "", state: raw.state ?? null }],
      dumpMonth: raw.dumpMonth,
      // Uma parte só: amostra de cerca de 1/10 das empresas, sem baixar os ~5 GB.
      parts: sample && !skipDump ? [1] : undefined,
      skipDump: hasBase && skipDump,
    });
    if (!parsed.success) {
      const next = fieldErrors(parsed.error);
      setErrors(next);
      setFailure(null);
      focusFirstError(form, next);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      onCreated(await createCnpjImport(parsed.data));
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Notice>
        Dados cadastrais públicos de pessoa jurídica. Em MEI e empresário individual o telefone pode ser
        pessoal, por isso a origem aparece junto do contato no painel da empresa.
      </Notice>
      <div className={formGridClass}>
        <Field id="cnpj-city" label="Cidade" error={errors.cities} hint="Como está na lista de empresas" className="col-span-4">
          {(c) => (
            <input
              {...c}
              name="city"
              required
              maxLength={80}
              autoComplete="off"
              list="cnpj-cidades"
              defaultValue={meta?.cities[0] ?? ""}
              className={inputClass}
            />
          )}
        </Field>
        <Field id="cnpj-state" label="UF" error={errors.state} className="col-span-2">
          {(c) => (
            <input
              {...c}
              name="state"
              maxLength={2}
              autoComplete="off"
              defaultValue={meta?.states[0] ?? ""}
              placeholder="SP"
              className={cx(inputClass, "uppercase")}
            />
          )}
        </Field>
        <Field
          id="cnpj-month"
          label="Mês do dump (opcional)"
          error={errors.dumpMonth}
          hint="Em branco: o mais recente publicado"
          className="col-span-6"
        >
          {(c) => <input {...c} name="dumpMonth" placeholder="2026-09" maxLength={7} autoComplete="off" className={inputClass} />}
        </Field>
      </div>
      {meta && meta.cities.length > 0 && (
        <datalist id="cnpj-cidades">
          {meta.cities.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
      )}
      {hasBase && (
        <Checkbox checked={skipDump} onChange={(e) => setSkipDump(e.currentTarget.checked)}>
          Só cruzar de novo, com o que já está na base (não baixa o dump)
        </Checkbox>
      )}
      <Checkbox
        checked={sample}
        disabled={skipDump}
        onChange={(e) => setSample(e.currentTarget.checked)}
      >
        Ler só uma parte dos estabelecimentos (amostra de cerca de 1/10 das empresas: baixa ~1,8 GB em vez
        de ~6,5 GB, e acha bem menos contatos)
      </Checkbox>
      <Button type="submit" variant="primary" loading={busy} icon={<DatabaseIcon />} className="w-full">
        {busy ? "Iniciando…" : skipDump ? "Cruzar de novo" : "Importar e cruzar"}
      </Button>
      {failure && (
        <p role="alert" className="flex items-start gap-1 text-legenda text-danger">
          <AlertIcon className="mt-px size-3.5 shrink-0" />
          {failure}
        </p>
      )}
    </form>
  );
}

// ---------- Cartão de importação ----------

function progressState(status: SearchStatus): ProgressState | null {
  return status === "done" ? null : status;
}

function ImportCard({
  job,
  takeFocus,
  onChanged,
}: {
  job: CnpjImportDTO;
  takeFocus: boolean;
  onChanged: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (takeFocus) ref.current?.focus();
  }, [takeFocus]);

  async function act(action: "pause" | "resume") {
    setBusy(true);
    setError(null);
    try {
      await actOnCnpjImport(job.id, action);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const titleId = `importacao-${job.id}`;
  const state = progressState(job.status);
  const stats: Array<[string, number]> = [
    ["Examinadas", job.examinedCount],
    ["Casadas", job.matchedCount],
    ["Ganharam telefone", job.phoneCount],
    ["Ganharam e-mail", job.emailCount],
    ["Sem desempate", job.ambiguousCount],
  ];

  return (
    <article
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cx(cardStyles(isActive(job)), "p-4 focus-visible:outline-offset-4")}
    >
      <header>
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="min-w-0 truncate text-forte font-semibold">
            {placeOf(job)} · dump de {monthLabel(job.dumpMonth)}
          </h3>
          <Badge tone={STATUS_TONE[job.status]}>
            {STATUS_ICON[job.status]}
            {STATUS_LABEL[job.status]}
          </Badge>
        </div>
        <p className="mt-0.5 text-legenda text-subtle">
          {job.parts.length === CNPJ_DUMP_PARTS
            ? "dump completo"
            : `${job.parts.length} de ${CNPJ_DUMP_PARTS} partes dos estabelecimentos`}{" "}
          · {formatNumber(job.scannedCount)} linhas lidas · {formatNumber(job.savedCount)} estabelecimentos
          guardados · criada em {formatDateTime(job.createdAt)}
        </p>
      </header>

      {job.unknownCities.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-legenda text-muted">
          <AlertIcon className="mt-px size-3.5 shrink-0 text-warn" />
          Não achei na tabela de municípios da Receita: {job.unknownCities.join(", ")}.
        </p>
      )}

      {state && (
        <div className="mt-3">
          <ProgressBar
            state={state}
            value={job.progress}
            label={`Progresso da importação de ${placeOf(job)}`}
            caption={
              state === "queued"
                ? "Esperando a vez na fila"
                : (job.stage && CNPJ_IMPORT_STAGE_LABEL[job.stage]) || "Preparando"
            }
          />
        </div>
      )}

      {job.status === "failed" && job.error && (
        <p className="mt-3 flex items-start gap-1.5 text-legenda text-danger">
          <AlertIcon className="mt-px size-3.5 shrink-0" />
          {job.error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <dl className="flex flex-wrap gap-x-4 gap-y-2 sm:gap-x-6">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-legenda text-subtle">{label}</dt>
              <dd className="font-display text-numero font-semibold text-fg tabular-nums">{formatNumber(value)}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          {isActive(job) && (
            <Button size="sm" loading={busy} icon={<PauseIcon />} onClick={() => act("pause")}>
              Pausar
            </Button>
          )}
          {(job.status === "paused" || job.status === "failed") && (
            <Button size="sm" loading={busy} icon={<PlayIcon />} onClick={() => act("resume")}>
              Retomar
            </Button>
          )}
          {job.phoneCount + job.emailCount > 0 && (
            <Link href="/?needsSite=yes&hasContact=yes&contacted=no" className={buttonStyles("secondary", "sm")}>
              Ver prontas para abordar
              <ChevronRightIcon />
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1 text-legenda text-danger">
          <AlertIcon className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </article>
  );
}

// ---------- Tela ----------

export function ReceitaView() {
  const meta = useApiGet<MetaResponse>(metaPath);
  const status = useApiGet<CnpjStatusResponse>(cnpjPath, {
    pollMs: 2000,
    pollWhile: (data) => data?.imports.some(isActive) ?? false,
  });
  const imports = status.data?.imports;
  const ordered = imports && [...imports.filter(isActive), ...imports.filter((i) => !isActive(i))];

  const [formOpen, setFormOpen] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Região ao vivo: só mudanças de situação são anunciadas, nunca cada avanço do percentual.
  const liveRef = useRef<HTMLParagraphElement>(null);
  const seen = useRef<Map<string, SearchStatus>>(new Map());
  useEffect(() => {
    if (!imports) return;
    for (const job of imports) {
      const before = seen.current.get(job.id);
      if (before && before !== job.status) {
        const text = statusAnnouncement(job);
        if (text && liveRef.current) liveRef.current.textContent = text;
      }
    }
    seen.current = new Map(imports.map((i) => [i.id, i.status]));
  }, [imports]);

  function handleCreated(created: CnpjImportDTO) {
    setFocusId(created.id);
    setFormOpen(false);
    status.reload();
    if (liveRef.current) {
      liveRef.current.textContent = `Importação iniciada para ${placeOf(created)}, dump de ${monthLabel(created.dumpMonth)}.`;
    }
  }

  return (
    <div className="space-y-6">
      <p ref={liveRef} aria-live="polite" className="sr-only" />

      <Section title="Base local">
        {status.error && !status.data ? (
          <ErrorState message="Não consegui carregar a situação da base." detail={status.error} onRetry={status.reload} />
        ) : (
          <BaseStatus status={status.data} />
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <Section
          title="Nova importação"
          actions={
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 lg:hidden"
              aria-expanded={formOpen}
              aria-controls="nova-importacao"
              onClick={() => setFormOpen((open) => !open)}
            >
              {formOpen ? "Recolher" : "Abrir"}
              <ChevronDownIcon className={cx("transition-transform", formOpen && "rotate-180")} />
            </Button>
          }
        >
          <div
            id="nova-importacao"
            className={cx(panelClass, "w-full max-w-lg p-5 lg:max-w-none", !formOpen && "hidden", "lg:block")}
          >
            <NewImportForm
              meta={meta.data}
              hasBase={(status.data?.establishments ?? 0) > 0}
              onCreated={handleCreated}
            />
          </div>
        </Section>

        <Section title="Histórico">
          {status.error && !ordered ? (
            <ErrorState
              message="Não consegui carregar as importações."
              detail={status.error}
              onRetry={status.reload}
            />
          ) : !ordered ? (
            <div className="space-y-3" role="status" aria-busy="true" aria-label="Carregando importações">
              {Array.from({ length: 2 }, (_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-card" />
              ))}
            </div>
          ) : ordered.length === 0 ? (
            <EmptyState
              title="Nenhuma importação ainda."
              description="Escolha a cidade ao lado e clique em Importar e cruzar. Dá para pausar e retomar a qualquer momento."
            />
          ) : (
            <ul className="space-y-3">
              {ordered.map((job) => (
                <li key={job.id}>
                  <ImportCard job={job} takeFocus={focusId === job.id} onChanged={status.reload} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
