"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { actOnSearch, createSearch, errorMessage, metaPath, searchesPath } from "@/lib/api";
import { searchInputSchema, type MetaResponse, type SearchDTO, type SearchStatus } from "@/lib/contract";
import { cx } from "@/lib/cx";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useApiGet } from "@/lib/use-api";
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SpinnerIcon,
} from "../icons";
import {
  fieldErrors,
  focusFirstError,
  GoogleKeyNotice,
  readForm,
  SearchFields,
  type FieldErrors,
} from "../search-fields";
import {
  Badge,
  Button,
  buttonStyles,
  cardStyles,
  EmptyState,
  ErrorState,
  formGridClass,
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

// Verde e âmbar têm dono (envio e oportunidade): a situação da pesquisa se diferencia por ícone e texto.
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

const PROVIDER_LABEL = { auto: "Automática", google: "Google", osm: "OpenStreetMap" } as const;

const isActive = (s: SearchDTO) => s.status === "queued" || s.status === "running";

const placeOf = (s: Pick<SearchDTO, "city" | "state">) => [s.city, s.state].filter(Boolean).join("/");

/** Texto lido pelo leitor de tela quando a situação de uma pesquisa muda (o percentual não é anunciado). */
function statusAnnouncement(search: SearchDTO, before: SearchStatus): string | null {
  const what = `${search.category} em ${search.city}`;
  switch (search.status) {
    case "done":
      return `Pesquisa concluída: ${formatNumber(search.foundCount)} empresas encontradas.`;
    case "failed":
      return `A pesquisa de ${what} falhou.`;
    case "paused":
      return `Pesquisa pausada: ${what}.`;
    case "running":
      return before === "paused" ? `Pesquisa retomada: ${what}.` : null;
    case "queued":
      return null;
  }
}

function NewSearchForm({ meta, onCreated }: { meta: MetaResponse | undefined; onCreated: (s: SearchDTO) => void }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const parsed = searchInputSchema.safeParse(readForm(form));
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
      const created = await createSearch(parsed.data);
      form.reset();
      onCreated(created);
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <GoogleKeyNotice config={meta?.config} />
      <div className={formGridClass}>
        <SearchFields errors={errors} prefix="search" />
      </div>
      <Button type="submit" variant="primary" loading={busy} icon={<PlusIcon />} className="w-full">
        {busy ? "Iniciando…" : "Iniciar pesquisa"}
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

function progressState(status: SearchStatus): ProgressState | null {
  return status === "done" ? null : status;
}

function SearchCard({
  search,
  takeFocus,
  onChanged,
}: {
  search: SearchDTO;
  takeFocus: boolean;
  onChanged: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cartão recém-criado: o foco vai para ele assim que entra na lista.
  useEffect(() => {
    if (takeFocus) ref.current?.focus();
  }, [takeFocus]);

  async function act(action: "pause" | "resume") {
    setBusy(true);
    setError(null);
    try {
      await actOnSearch(search.id, action);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const place = placeOf(search);
  const titleId = `pesquisa-${search.id}`;
  const state = progressState(search.status);
  const stats: Array<[string, number]> = [
    ["Encontradas", search.foundCount],
    ["Novas", search.newCount],
    ["Atualizadas", search.updatedCount],
    ["Consultas", search.requestCount],
  ];

  return (
    <article
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cx(cardStyles(isActive(search)), "p-4 focus-visible:outline-offset-4")}
    >
      <header>
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="min-w-0 truncate text-forte font-semibold">
            {search.category} · {place}
          </h3>
          <Badge tone={STATUS_TONE[search.status]}>
            {STATUS_ICON[search.status]}
            {STATUS_LABEL[search.status]}
          </Badge>
        </div>
        <p className="mt-0.5 text-legenda text-subtle">
          {search.keywords ? `“${search.keywords}” · ` : ""}
          raio de {formatNumber(search.radiusKm)} km · {PROVIDER_LABEL[search.provider]} · até{" "}
          {formatNumber(search.maxLeads)} empresas · criada em {formatDateTime(search.createdAt)}
        </p>
      </header>

      {state && (
        <div className="mt-3">
          <ProgressBar
            state={state}
            value={search.progress}
            label={`Progresso da pesquisa de ${search.category} em ${search.city}`}
            caption={
              state === "queued"
                ? "Esperando a vez na fila"
                : `${formatNumber(search.foundCount)} de até ${formatNumber(search.maxLeads)} empresas`
            }
          />
        </div>
      )}

      {search.status === "failed" && search.error && (
        <p className="mt-3 flex items-start gap-1.5 text-legenda text-danger">
          <AlertIcon className="mt-px size-3.5 shrink-0" />
          {search.error}
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
          {isActive(search) && (
            <Button size="sm" loading={busy} icon={<PauseIcon />} onClick={() => act("pause")}>
              Pausar
            </Button>
          )}
          {search.status === "paused" && (
            <Button size="sm" loading={busy} icon={<PlayIcon />} onClick={() => act("resume")}>
              Retomar
            </Button>
          )}
          <Link
            href={`/?searchId=${encodeURIComponent(search.id)}&todas=1`}
            className={buttonStyles("secondary", "sm")}
          >
            Ver empresas
            <ChevronRightIcon />
          </Link>
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

export function SearchesView() {
  const meta = useApiGet<MetaResponse>(metaPath);
  const searches = useApiGet<SearchDTO[]>(searchesPath, {
    pollMs: 2000,
    pollWhile: (data) => data?.some(isActive) ?? false,
  });
  const items = searches.data;
  // A pesquisa em andamento ou na fila fica fixada no topo do histórico.
  const ordered = items && [...items.filter(isActive), ...items.filter((s) => !isActive(s))];

  // Abaixo de 1024 px o formulário é um bloco recolhível (aberto ao entrar); no desktop fica sempre aberto.
  const [formOpen, setFormOpen] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Região ao vivo única: só mudanças de situação são anunciadas, nunca cada avanço do percentual.
  const liveRef = useRef<HTMLParagraphElement>(null);
  const seen = useRef<Map<string, SearchStatus>>(new Map());
  useEffect(() => {
    if (!items) return;
    for (const search of items) {
      const before = seen.current.get(search.id);
      if (before && before !== search.status) {
        const text = statusAnnouncement(search, before);
        if (text && liveRef.current) liveRef.current.textContent = text;
      }
    }
    seen.current = new Map(items.map((s) => [s.id, s.status]));
  }, [items]);

  function handleCreated(created: SearchDTO) {
    setFocusId(created.id);
    setFormOpen(false);
    searches.reload();
    if (liveRef.current) liveRef.current.textContent = `Pesquisa iniciada: ${created.category} em ${created.city}.`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
      <p ref={liveRef} aria-live="polite" className="sr-only" />

      <Section
        title="Nova pesquisa"
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2 lg:hidden"
            aria-expanded={formOpen}
            aria-controls="nova-pesquisa"
            onClick={() => setFormOpen((open) => !open)}
          >
            {formOpen ? "Recolher" : "Abrir"}
            <ChevronDownIcon className={cx("transition-transform", formOpen && "rotate-180")} />
          </Button>
        }
      >
        <div
          id="nova-pesquisa"
          className={cx(panelClass, "w-full max-w-lg p-5 lg:max-w-none", !formOpen && "hidden", "lg:block")}
        >
          <NewSearchForm meta={meta.data} onCreated={handleCreated} />
        </div>
      </Section>

      <Section title="Histórico">
        {searches.error && !items ? (
          <ErrorState message="Não consegui carregar as pesquisas." detail={searches.error} onRetry={searches.reload} />
        ) : !ordered ? (
          <div className="space-y-3" role="status" aria-busy="true" aria-label="Carregando pesquisas">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-card" />
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <EmptyState
            title="Nenhuma pesquisa ainda."
            description="Preencha o formulário e clique em Iniciar pesquisa."
          />
        ) : (
          <div className="space-y-3">
            {searches.error && (
              <ErrorState
                message="Não consegui carregar as pesquisas."
                detail={searches.error}
                onRetry={searches.reload}
              />
            )}
            <ul className="space-y-3">
              {ordered.map((search) => (
                <li key={search.id}>
                  <SearchCard search={search} takeFocus={focusId === search.id} onChanged={searches.reload} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </div>
  );
}
