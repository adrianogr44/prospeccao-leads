"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { leadsPath, metaPath, searchesPath, statsPath, type LeadSort } from "@/lib/api";
import type {
  LeadDTO,
  LeadFilters,
  LeadListResponse,
  MetaResponse,
  SearchDTO,
  StatsResponse,
} from "@/lib/contract";
import { useApiGet } from "@/lib/use-api";
import { DEFAULT_VIEW, defaultDir, parseView, patchFilters, viewToParams, type ViewState } from "@/lib/view-state";
import { PlusIcon } from "../icons";
import { Button, EmptyState, ErrorState, PageHeader, Section, buttonStyles } from "../ui";
import { Charts } from "./charts";
import { ExportMenu } from "./export-menu";
import { FiltersBar } from "./filters-bar";
import { LeadDrawer } from "./lead-drawer";
import { LeadsTable, Pagination, TableSkeleton } from "./leads-table";
import { StatCards } from "./stat-cards";

export function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = useMemo(() => parseView(searchParams), [searchParams]);
  const [selected, setSelected] = useState<LeadDTO | null>(null);

  const setView = useCallback(
    (next: ViewState) => {
      const query = viewToParams(next).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const meta = useApiGet<MetaResponse>(metaPath);
  const searches = useApiGet<SearchDTO[]>(searchesPath);
  const stats = useApiGet<StatsResponse>(statsPath(view.filters));
  const leads = useApiGet<LeadListResponse>(
    leadsPath({ ...view.filters, page: view.page, pageSize: view.pageSize, sort: view.sort, dir: view.dir }),
  );

  const changeFilters = (patch: Partial<LeadFilters>) =>
    setView({ ...view, filters: patchFilters(view.filters, patch), page: 1 });
  const clearFilters = () => setView({ ...view, filters: DEFAULT_VIEW.filters, page: 1 });
  const changeSort = (field: LeadSort) =>
    setView({
      ...view,
      sort: field,
      dir: view.sort === field ? (view.dir === "asc" ? "desc" : "asc") : defaultDir(field),
      page: 1,
    });

  // Se a página pedida passou do fim (ex.: filtro reduziu o resultado), volta para a última.
  const total = leads.data?.total;
  const lastPage = total === undefined ? undefined : Math.max(1, Math.ceil(total / view.pageSize));
  useEffect(() => {
    if (lastPage !== undefined && view.page > lastPage) setView({ ...view, page: lastPage });
  }, [lastPage, view, setView]);

  const reloadAll = () => {
    leads.reload();
    stats.reload();
    meta.reload();
  };

  const hasFilters = Object.keys(view.filters).length > 0;
  const items = leads.data?.items;

  return (
    <>
      <PageHeader title="Dashboard" description="Empresas encontradas e quais delas precisam de um site.">
        <ExportMenu filters={view.filters} meta={meta.data} />
        <Link href="/pesquisas" className={buttonStyles("primary")}>
          <PlusIcon />
          Nova pesquisa
        </Link>
      </PageHeader>

      <Section title="Indicadores" srOnlyTitle>
        {stats.error && !stats.data ? (
          <ErrorState message={stats.error} onRetry={stats.reload} />
        ) : (
          <StatCards
            stats={stats.data}
            filters={view.filters}
            loading={stats.loading}
            onApply={changeFilters}
          />
        )}
      </Section>

      <Charts stats={stats.data} />

      <Section title="Filtros" srOnlyTitle>
        <FiltersBar
          filters={view.filters}
          meta={meta.data}
          searches={searches.data}
          onChange={changeFilters}
          onClear={clearFilters}
        />
      </Section>

      <Section title="Empresas">
        {leads.error && !items ? (
          <ErrorState message={leads.error} onRetry={leads.reload} />
        ) : !items ? (
          <div className="rounded-lg border border-line">
            <TableSkeleton />
          </div>
        ) : items.length === 0 ? (
          hasFilters ? (
            <EmptyState title="Nenhuma empresa com esses filtros.">
              <Button onClick={clearFilters}>Limpar filtros</Button>
            </EmptyState>
          ) : (
            <EmptyState title="Nenhuma empresa ainda. Faça sua primeira pesquisa.">
              <Link href="/pesquisas" className={buttonStyles("primary")}>
                <PlusIcon />
                Nova pesquisa
              </Link>
            </EmptyState>
          )
        ) : (
          <>
            {leads.error && <ErrorState message={leads.error} onRetry={leads.reload} />}
            <LeadsTable
              items={items}
              sort={view.sort}
              dir={view.dir}
              onSort={changeSort}
              onSelect={setSelected}
              busy={leads.loading}
            />
            <Pagination
              page={view.page}
              pageSize={view.pageSize}
              total={leads.data?.total ?? 0}
              onPage={(page) => setView({ ...view, page })}
              onPageSize={(pageSize) => setView({ ...view, pageSize, page: 1 })}
            />
          </>
        )}
      </Section>

      {selected && (
        <LeadDrawer
          lead={selected}
          onClose={() => setSelected(null)}
          onNotesSaved={(updated) => {
            setSelected(updated);
            leads.mutate((current) =>
              current
                ? { ...current, items: current.items.map((l) => (l.id === updated.id ? updated : l)) }
                : current,
            );
          }}
          onDeleted={() => {
            setSelected(null);
            reloadAll();
          }}
        />
      )}
    </>
  );
}
