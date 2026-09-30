"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { actOnSearch, createSearch, errorMessage, metaPath, searchesPath } from "@/lib/api";
import { searchInputSchema, type MetaResponse, type SearchDTO, type SearchStatus } from "@/lib/contract";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useApiGet } from "@/lib/use-api";
import { PauseIcon, PlayIcon, PlusIcon } from "../icons";
import { fieldErrors, GoogleKeyNotice, readForm, SearchFields, type FieldErrors } from "../search-fields";
import { Badge, Button, buttonStyles, EmptyState, ErrorState, Section, Skeleton, type BadgeTone } from "../ui";

const STATUS_LABEL: Record<SearchStatus, string> = {
  queued: "Na fila",
  running: "Em andamento",
  paused: "Pausada",
  done: "Concluída",
  failed: "Falhou",
};

const STATUS_TONE: Record<SearchStatus, BadgeTone> = {
  queued: "neutral",
  running: "accent",
  paused: "warn",
  done: "neutral",
  failed: "danger",
};

const PROVIDER_LABEL = { auto: "Automática", google: "Google", osm: "OpenStreetMap" } as const;

const isActive = (s: SearchDTO) => s.status === "queued" || s.status === "running";

function NewSearchForm({ meta, onCreated }: { meta: MetaResponse | undefined; onCreated: () => void }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = searchInputSchema.safeParse(readForm(form));
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFailure(null);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await createSearch(parsed.data);
      form.reset();
      onCreated();
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-lg border border-line bg-surface p-3">
      <GoogleKeyNotice config={meta?.config} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchFields errors={errors} prefix="search" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy}>
          <PlusIcon />
          {busy ? "Iniciando…" : "Iniciar pesquisa"}
        </Button>
        {failure && (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        )}
      </div>
    </form>
  );
}

function ProgressCell({ search }: { search: SearchDTO }) {
  const value = Math.max(0, Math.min(100, Math.round(search.progress)));
  return (
    <div className="w-32">
      <div
        role="progressbar"
        aria-label={`Progresso da pesquisa de ${search.category} em ${search.city}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted tabular-nums" aria-live="polite">
        {value}%
      </p>
    </div>
  );
}

function SearchRow({ search, onChanged }: { search: SearchDTO; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const place = [search.city, search.state].filter(Boolean).join("/");
  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <td className="px-3 py-2.5">
        <p className="font-medium">
          {search.category} · {place}
        </p>
        <p className="text-xs text-muted">
          {search.keywords ? `“${search.keywords}” · ` : ""}
          raio de {formatNumber(search.radiusKm)} km · {PROVIDER_LABEL[search.provider]} · até{" "}
          {formatNumber(search.maxLeads)} empresas
        </p>
        <p className="text-xs text-muted">Criada em {formatDateTime(search.createdAt)}</p>
      </td>
      <td className="px-3 py-2.5">
        <Badge tone={STATUS_TONE[search.status]}>{STATUS_LABEL[search.status]}</Badge>
        {search.status === "failed" && search.error && (
          <p className="mt-1 max-w-48 text-xs text-danger">{search.error}</p>
        )}
      </td>
      <td className="px-3 py-2.5">
        <ProgressCell search={search} />
      </td>
      <td className="px-3 py-2.5 text-xs text-muted tabular-nums">
        <p>{formatNumber(search.foundCount)} encontradas</p>
        <p>
          {formatNumber(search.newCount)} novas · {formatNumber(search.updatedCount)} atualizadas
        </p>
        <p>{formatNumber(search.requestCount)} consultas</p>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-2">
          {isActive(search) && (
            <Button size="sm" onClick={() => act("pause")} disabled={busy}>
              <PauseIcon className="size-3.5" />
              Pausar
            </Button>
          )}
          {search.status === "paused" && (
            <Button size="sm" onClick={() => act("resume")} disabled={busy}>
              <PlayIcon className="size-3.5" />
              Retomar
            </Button>
          )}
          <Link href={`/?searchId=${encodeURIComponent(search.id)}`} className={buttonStyles("secondary", "sm")}>
            Ver leads
          </Link>
        </div>
        {error && (
          <p role="alert" className="mt-1 max-w-48 text-xs text-danger">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

export function SearchesView() {
  const meta = useApiGet<MetaResponse>(metaPath);
  const searches = useApiGet<SearchDTO[]>(searchesPath, {
    pollMs: 2000,
    pollWhile: (data) => data?.some(isActive) ?? false,
  });
  const items = searches.data;

  return (
    <>
      <Section title="Nova pesquisa">
        <NewSearchForm meta={meta.data} onCreated={searches.reload} />
      </Section>

      <Section title="Histórico">
        {searches.error && !items ? (
          <ErrorState message={searches.error} onRetry={searches.reload} />
        ) : !items ? (
          <div className="space-y-2" role="status" aria-busy="true" aria-label="Carregando pesquisas">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Nenhuma pesquisa ainda. Preencha o formulário acima para começar." />
        ) : (
          <>
            {searches.error && <ErrorState message={searches.error} onRetry={searches.reload} />}
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[56rem] border-collapse text-sm">
                <caption className="sr-only">Histórico de pesquisas</caption>
                <thead>
                  <tr className="border-b border-line bg-surface text-left text-xs font-medium text-muted">
                    <th scope="col" className="px-3 py-2">
                      Pesquisa
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Situação
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Progresso
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Resultado
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((search) => (
                    <SearchRow key={search.id} search={search} onChanged={searches.reload} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>
    </>
  );
}
