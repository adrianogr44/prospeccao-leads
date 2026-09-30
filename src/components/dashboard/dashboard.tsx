"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  errorMessage,
  getLead,
  leadPointsPath,
  leadsPath,
  metaPath,
  outreachSettingsPath,
  searchesPath,
  setLeadContacted,
  statsPath,
  type LeadSort,
} from "@/lib/api";
import {
  SITE_STATUS_LABEL,
  type LeadDTO,
  type LeadFilters,
  type LeadListResponse,
  type LeadPointsResponse,
  type MetaResponse,
  type OutreachSettings,
  type SearchDTO,
  type StatsResponse,
} from "@/lib/contract";
import { cx } from "@/lib/cx";
import { formatNumber } from "@/lib/format";
import { outreachTarget } from "@/lib/outreach";
import { useApiGet } from "@/lib/use-api";
import { setPref, useMediaQuery, usePref } from "@/lib/use-client-state";
import {
  activeStage,
  baseFilters,
  defaultDir,
  FUNNEL_STAGES,
  LEAK_FILTERS,
  parseView,
  patchFilters,
  viewToParams,
  withStage,
  type FunnelStage,
  type ViewState,
} from "@/lib/view-state";
import { ChevronDownIcon, PlusIcon } from "../icons";
import { thermoText } from "../lead-ui";
import { Sheet } from "../modal";
import { Button, buttonStyles, EmptyState, ErrorState, panelClass } from "../ui";
import { ExportMenu } from "./export-menu";
import { FiltersBar, SearchBox } from "./filters";
import { Funnel } from "./funnel";
import { LeadPanel, type PanelFocus } from "./lead-panel";
import { LeadRows, ListBar, ListSkeleton, Pagination } from "./lead-list";
import { Panorama } from "./panorama";
import { RadarMap } from "./radar-map";

type Selection =
  | { kind: "none" }
  | { kind: "id"; id: string; lead: LeadDTO }
  /** Selecionar ao chegar a página nova (Próxima/Anterior atravessando páginas). */
  | { kind: "pending"; page: number; pick: "first" | "firstOpen" | "last" };

type LiveEvent = { kind: "list" } | { kind: "page" } | { kind: "select" } | { kind: "text"; text: string };

const MAP_PREF = "radar:mapa";
/** "0" = atalhos de tecla única desligados (WCAG 2.1.4). Ausente = ligados. */
const SHORTCUTS_PREF = "radar:atalhos";
const LEAD_SHEET_ID = "painel-empresa-folha";
const PANEL_HEADING_ID = "painel-empresa-titulo";
const LIVE_DELAY_MS = 400;

const stageLabel = (stage: FunnelStage | null) => FUNNEL_STAGES.find((s) => s.id === stage)?.label ?? null;

function pickFrom(items: LeadDTO[], pick: "first" | "firstOpen" | "last"): LeadDTO | null {
  if (pick === "last") return items.at(-1) ?? null;
  if (pick === "firstOpen") return items.find((l) => !l.contactedAt) ?? null;
  return items[0] ?? null;
}

/** Foca a linha da lista (depois do próximo quadro, quando ela já existe). */
function focusRow(id: string | null, fallback?: string) {
  requestAnimationFrame(() => {
    const row = id ? document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"] [data-row-main]`) : null;
    if (row) row.focus();
    else if (fallback) document.getElementById(fallback)?.focus();
  });
}

function visible(selector: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find((el) => el.offsetParent !== null) ?? null
  );
}

/** Depois que o React aplicou a resposta de uma requisição (fora de evento, o quadro seguinte ainda pode ser o antigo). */
function afterRender(callback: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

/** Campo do painel com texto que ainda não foi salvo nem enviado (marcado com `data-dirty`). */
const isDirty = (field: HTMLElement | null) => field?.dataset.dirty === "true";

const focusPanelHeading = () => document.getElementById(PANEL_HEADING_ID)?.focus();

/** O botão acionado saiu da tela e o foco caiu no `body`: leva-o para `fallback`. Não puxa o foco de quem já seguiu adiante. */
function refocusIfLost(fallback: () => HTMLElement | null) {
  afterRender(() => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    fallback()?.focus();
  });
}

export function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = useMemo(() => parseView(searchParams), [searchParams]);
  const filters = view.filters;

  const setView = useCallback(
    (next: ViewState) => {
      const query = viewToParams(next).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  // ---------- Dados ----------
  const isXl = useMediaQuery("(min-width: 1280px)");
  const mapPref = usePref(MAP_PREF);
  const mapOpen = mapPref === null ? isXl : mapPref === "1";
  const shortcutsEnabled = usePref(SHORTCUTS_PREF) !== "0";

  const stage = activeStage(filters);
  const base = baseFilters(filters);
  const hasStage = Object.keys(base).length !== Object.keys(filters).length;

  const meta = useApiGet<MetaResponse>(metaPath);
  const searches = useApiGet<SearchDTO[]>(searchesPath);
  const outreach = useApiGet<OutreachSettings>(outreachSettingsPath);
  const stats = useApiGet<StatsResponse>(statsPath(filters));
  const leads = useApiGet<LeadListResponse>(
    leadsPath({ ...filters, page: view.page, pageSize: view.pageSize, sort: view.sort, dir: view.dir }),
  );
  const pointsPath = leadPointsPath(filters);
  const points = useApiGet<LeadPointsResponse>(mapOpen ? pointsPath : null);
  const context = useApiGet<LeadPointsResponse>(mapOpen && hasStage ? leadPointsPath(base) : null);

  // ---------- Estado da tela ----------
  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const [request, setRequest] = useState<{ n: number; focus: PanelFocus }>({ n: 0, focus: null });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [sent, setSent] = useState<{ id: string; at: string } | null>(null);
  const [sendError, setSendError] = useState<{ id: string; message: string } | null>(null);
  const [queueDone, setQueueDone] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [panoramaOpen, setPanoramaOpen] = useState(false);
  const [live, setLive] = useState<LiveEvent | null>(null);
  /** Última linha fechada com Esc: continua sendo o ponto de Tab da lista. */
  const [lastRowId, setLastRowId] = useState<string | null>(null);

  const items = leads.data?.items;
  const total = leads.data?.total;
  const fresh = leads.data !== undefined && !leads.loading && leads.data.page === view.page;
  const lastPage = total === undefined ? undefined : Math.max(1, Math.ceil(total / view.pageSize));

  let selected: LeadDTO | null = null;
  if (selection.kind === "id") selected = items?.find((l) => l.id === selection.id) ?? selection.lead;
  else if (selection.kind === "pending" && fresh && items && selection.page === view.page) {
    selected = pickFrom(items, selection.pick);
  }
  const selectedId = selected?.id ?? null;
  const index = selectedId && items ? items.findIndex((l) => l.id === selectedId) : -1;
  const wide = useMediaQuery("(min-width: 640px)", true);

  // Se a página pedida passou do fim (ex.: filtro reduziu o resultado), volta para a última.
  useEffect(() => {
    if (lastPage !== undefined && view.page > lastPage) setView({ ...view, page: lastPage });
  }, [lastPage, view, setView]);

  // ---------- Ações ----------
  const changeView = (next: ViewState, event: LiveEvent = { kind: "list" }) => {
    setView(next);
    setLive(event);
    setQueueDone(false);
    setLastRowId(null);
  };
  const changeFilters = (patch: Partial<LeadFilters>) =>
    changeView({ ...view, filters: patchFilters(filters, patch), page: 1 });
  const setFilters = (next: LeadFilters) => changeView({ ...view, filters: next, page: 1 });
  const clearAll = () => setFilters({});
  const onStage = (target: FunnelStage) =>
    setFilters(withStage(filters, stage === target && target !== "found" ? "found" : target));
  const leakActive = activeStage(filters) === null && filters.needsSite === "yes" && filters.hasContact === "no";
  const onLeak = () => setFilters(leakActive ? withStage(filters, "found") : patchFilters(base, LEAK_FILTERS));

  const selectLead = (lead: LeadDTO, focus: PanelFocus = null) => {
    if (lead.id !== selectedId || focus) setRequest((r) => ({ n: r.n + 1, focus }));
    setSelection({ kind: "id", id: lead.id, lead });
    setLive({ kind: "select" });
    setQueueDone(false);
  };

  const closePanel = () => {
    const id = selectedId;
    setSelection({ kind: "none" });
    setLastRowId(id);
    setLive(null);
    focusRow(id);
  };

  const applyUpdate = (updated: LeadDTO) => {
    leads.mutate((current) =>
      current ? { ...current, items: current.items.map((l) => (l.id === updated.id ? updated : l)) } : current,
    );
    setSelection((s) => (s.kind === "id" && s.id === updated.id ? { ...s, lead: updated } : s));
  };

  const markPoint = (id: string, contacted: boolean) =>
    points.mutate((current) =>
      current ? { ...current, points: current.points.map((p) => (p.id === id ? { ...p, contacted } : p)) } : current,
    );

  /** Botão de envio (linha, painel ou tecla E): a conversa já abriu; marca como contatada de forma otimista. */
  const handleSend = (lead: LeadDTO) => {
    const at = new Date().toISOString();
    const channel = outreachTarget(lead).kind === "email" ? "no e-mail" : "no WhatsApp";
    applyUpdate({ ...lead, contactedAt: at });
    markPoint(lead.id, true);
    setSent({ id: lead.id, at });
    setSendError(null);
    setLive({ kind: "text", text: `Proposta aberta ${channel} para ${lead.name}. Marcada como contatada.` });
    setLeadContacted(lead.id, true)
      .then((updated) => {
        applyUpdate(updated);
        stats.reload();
      })
      .catch(() => {
        applyUpdate(lead);
        markPoint(lead.id, lead.contactedAt !== null);
        setSendError({ id: lead.id, message: "A conversa abriu, mas não consegui marcar como contatada." });
      });
  };

  const retryMark = (lead: LeadDTO) => {
    setLeadContacted(lead.id, true)
      .then((updated) => {
        applyUpdate(updated);
        markPoint(lead.id, true);
        setSendError(null);
        stats.reload();
      })
      .catch((e: unknown) => setSendError({ id: lead.id, message: errorMessage(e) }));
  };

  const unmark = (lead: LeadDTO) => {
    setLeadContacted(lead.id, false)
      .then((updated) => {
        applyUpdate(updated);
        markPoint(lead.id, false);
        setSent(null);
        setSendError(null);
        setLive({ kind: "text", text: `Contato desmarcado: ${lead.name}.` });
        stats.reload();
        // "Desmarcar" some da barra; o foco vai para o envio, que volta a existir.
        refocusIfLost(
          () =>
            visible(`a[data-send="panel"][data-lead-id="${CSS.escape(lead.id)}"]`) ??
            document.getElementById(PANEL_HEADING_ID),
        );
      })
      .catch((e: unknown) => setSendError({ id: lead.id, message: errorMessage(e) }));
  };

  /** J/K, Anterior/Próxima e "Próxima empresa". Atravessa páginas; no fim da fila mostra "Fila concluída". */
  const move = (delta: 1 | -1, opts: { skipContacted?: boolean; focusList?: boolean } = {}) => {
    if (!items || items.length === 0) return;
    const skip = (l: LeadDTO | undefined) => Boolean(opts.skipContacted && l?.contactedAt);
    let i = index === -1 ? 0 : index + delta;
    while (i >= 0 && i < items.length && skip(items[i])) i += delta;

    if (i >= 0 && i < items.length) {
      const lead = items[i];
      selectLead(lead, opts.skipContacted ? "heading" : null);
      if (opts.focusList) focusRow(lead.id);
      else
        requestAnimationFrame(() =>
          document
            .querySelector(`[data-row-id="${CSS.escape(lead.id)}"]`)
            ?.scrollIntoView({ block: "nearest" }),
        );
      return;
    }
    if (i >= items.length && lastPage !== undefined && view.page < lastPage) {
      setRequest((r) => ({ n: r.n + 1, focus: opts.skipContacted ? "heading" : null }));
      setSelection({ kind: "pending", page: view.page + 1, pick: opts.skipContacted ? "firstOpen" : "first" });
      changeView({ ...view, page: view.page + 1 }, { kind: "page" });
      return;
    }
    if (i < 0 && view.page > 1) {
      setSelection({ kind: "pending", page: view.page - 1, pick: "last" });
      changeView({ ...view, page: view.page - 1 }, { kind: "page" });
      return;
    }
    if (opts.skipContacted) setQueueDone(true);
  };

  const openFromMap = (id: string) => {
    const inPage = items?.find((l) => l.id === id);
    if (inPage) {
      selectLead(inPage);
      requestAnimationFrame(() =>
        document.querySelector(`[data-row-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" }),
      );
      return;
    }
    getLead(id)
      .then((lead) => selectLead(lead))
      .catch((e: unknown) => setLive({ kind: "text", text: errorMessage(e) }));
  };

  const handleDeleted = (lead: LeadDTO) => {
    const i = items?.findIndex((l) => l.id === lead.id) ?? -1;
    const next = items && i !== -1 ? (items[i + 1] ?? items[i - 1] ?? null) : null;
    leads.mutate((current) =>
      current
        ? { ...current, total: current.total - 1, items: current.items.filter((l) => l.id !== lead.id) }
        : current,
    );
    points.mutate((current) =>
      current ? { ...current, total: current.total - 1, points: current.points.filter((p) => p.id !== lead.id) } : current,
    );
    setSelection({ kind: "none" });
    setLive({ kind: "text", text: `Empresa excluída: ${lead.name}.` });
    focusRow(next?.id ?? null, "barra-lista");
    stats.reload();
    meta.reload();
  };

  const toggleMap = () => {
    setPref(MAP_PREF, mapOpen ? "0" : "1");
    setLive({ kind: "text", text: mapOpen ? "Mapa recolhido." : "Mapa aberto." });
  };
  const setShortcutsEnabled = (enabled: boolean) => setPref(SHORTCUTS_PREF, enabled ? "1" : "0");

  /** Tecla E: o mesmo efeito do botão de envio (painel primeiro, depois a linha). */
  const sendSelected = () => {
    if (!selected) return;
    const id = CSS.escape(selected.id);
    const anchor =
      visible(`a[data-send="panel"][data-lead-id="${id}"]`) ?? visible(`a[data-send="row"][data-lead-id="${id}"]`);
    if (anchor) anchor.click();
    else selectLead(selected, "whatsapp");
  };

  // ---------- Atalhos ----------
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const openModal = document.querySelector("dialog[open]");
    // Outros diálogos (exportar, filtros) têm prioridade; a folha da empresa aceita os atalhos.
    if (openModal && openModal.id !== LEAD_SHEET_ID) return;
    const field = target?.closest<HTMLElement>("input, textarea, select, [contenteditable='true']") ?? null;
    if (event.key === "Escape") {
      // Esc não é atalho de tecla única: vale sempre, com os atalhos ligados ou não.
      if (openModal) {
        // Gaveta da empresa: campo com texto não salvo só perde o foco (o 2º Esc fecha). Sem isso o <dialog> fecha sozinho.
        if (isDirty(field)) {
          event.preventDefault();
          focusPanelHeading();
        }
        return;
      }
      if (shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }
      if (field) {
        // Só os campos do painel: busca e filtros seguem com o Esc do próprio campo.
        if (!selected || !field.closest("[data-lead-panel]")) return;
        event.preventDefault();
        if (isDirty(field)) focusPanelHeading();
        else closePanel();
        return;
      }
      if (selected) {
        event.preventDefault();
        closePanel();
      }
      return;
    }
    if (field || !shortcutsEnabled) return;
    const inList = Boolean(target?.closest("[data-row-id]")) || target === document.body;
    switch (event.key.toLowerCase()) {
      case "j":
        move(1, { focusList: inList });
        break;
      case "k":
        move(-1, { focusList: inList });
        break;
      case "e":
        // Abre o WhatsApp de verdade: só com empresa selecionada e foco na lista ou no painel, nunca de qualquer lugar.
        if (!selected || !target?.closest("#lista-empresas, [data-lead-panel]")) return;
        sendSelected();
        break;
      case "n":
        if (!selected) return;
        visible("#lead-notes")?.focus();
        break;
      case "c":
        if (!selected) return;
        visible('[data-action="copy"]')?.click();
        break;
      case "m":
        toggleMap();
        break;
      case "/":
        visible("[data-search]")?.focus();
        break;
      case "?": {
        const next = !shortcutsOpen;
        setShortcutsOpen(next);
        if (next) requestAnimationFrame(() => document.getElementById("atalhos")?.focus());
        else if (document.getElementById("atalhos")?.contains(target)) visible('[aria-controls="atalhos"]')?.focus();
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKey(event);
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ---------- Textos derivados ----------
  const funnel = stats.data?.funnel;
  const cities = meta.data?.cities ?? [];
  const categories = meta.data?.categories ?? [];
  const city = filters.city ?? (cities.length === 1 ? cities[0] : undefined);
  const category = filters.category ?? (categories.length === 1 ? categories[0] : undefined);
  const recorte = city && category ? `${category} em ${city}` : (category ?? city ?? null);

  const pages = lastPage ?? 1;
  let liveText = "";
  if (live?.kind === "text") liveText = live.text;
  else if (live?.kind === "select" && selected) {
    const pos = index !== -1 && total !== undefined ? ` ${(view.page - 1) * view.pageSize + index + 1} de ${total}.` : "";
    liveText = `${selected.name}, ${thermoText(selected.stars, selected.score)}, ${SITE_STATUS_LABEL[selected.siteStatus]}.${pos}`;
  } else if (live && fresh && total !== undefined) {
    const mapTotal = mapOpen && points.data && !points.loading ? points.data.total : undefined;
    const mapText = mapTotal === undefined ? "" : ` Mapa: ${formatNumber(mapTotal)} ${mapTotal === 1 ? "empresa" : "empresas"}.`;
    liveText =
      live.kind === "page"
        ? `Página ${view.page} de ${pages}, ${items?.length ?? 0} empresas.`
        : `${formatNumber(total)} empresas.${stage ? ` Etapa: ${stageLabel(stage)}.` : ""}${mapText}`;
  }

  // Espera 400 ms de silêncio antes de anunciar: digitar ou percorrer com J/K não vira uma enxurrada de falas.
  const [spoken, setSpoken] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSpoken(liveText), LIVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [liveText]);

  const baseEmpty =
    stats.data !== undefined && stats.data.funnel.found === 0 && Object.keys(base).length === 0;
  const hasFilters = Object.keys(filters).length > 0;
  const contactedCount = funnel?.contacted ?? 0;

  // ---------- Painel ----------
  const panel = selected && (
    <LeadPanel
      lead={selected}
      requestKey={request.n}
      focus={request.focus}
      position={index !== -1 && total !== undefined ? { index: (view.page - 1) * view.pageSize + index + 1, total } : null}
      canPrev={index > 0 || (index !== -1 && view.page > 1)}
      canNext={
        index === -1 ? (items?.length ?? 0) > 0 : index < (items?.length ?? 0) - 1 || view.page < (lastPage ?? 1)
      }
      onPrev={() => move(-1)}
      onNext={() => move(1)}
      onClose={closePanel}
      settings={outreach.data}
      settingsError={outreach.error}
      onRetrySettings={outreach.reload}
      sentAt={sent?.id === selected.id ? sent.at : null}
      sendError={sendError?.id === selected.id ? sendError.message : null}
      onUpdated={applyUpdate}
      onDeleted={handleDeleted}
      onSend={handleSend}
      onRetryMark={retryMark}
      onUnmark={unmark}
      onNextQueued={() => move(1, { skipContacted: true })}
    />
  );

  // ---------- Lista ----------
  let listBody;
  if (leads.error && !items) {
    listBody = (
      <div className="p-3">
        <ErrorState message="Não consegui carregar as empresas." detail={leads.error} onRetry={leads.reload} />
      </div>
    );
  } else if (!items) {
    listBody = <ListSkeleton />;
  } else if (items.length === 0) {
    let empty;
    if (stage === "ready" && funnel && funnel.found > 0 && funnel.needsSite === 0) {
      empty = (
        <EmptyState
          title="Nenhuma empresa pronta para abordar."
          description={`Nenhuma das ${formatNumber(funnel.found)} empresas encontradas precisa de site.`}
        >
          <Link href="/pesquisas" className={buttonStyles("primary")}>
            Nova pesquisa
          </Link>
        </EmptyState>
      );
    } else if (stage === "ready" && funnel && funnel.needsSite > funnel.reachable) {
      const n = funnel.needsSite - funnel.reachable;
      empty = (
        <EmptyState
          title="Nenhuma empresa pronta para abordar."
          description={`${formatNumber(n)} empresas precisam de site, mas ainda não têm contato. Informe o WhatsApp delas para liberar o envio.`}
        >
          <Button variant="primary" onClick={() => setFilters(patchFilters(base, LEAK_FILTERS))}>
            Ver empresas sem contato
          </Button>
        </EmptyState>
      );
    } else if (stage === "ready" && funnel && funnel.contacted > 0) {
      empty = (
        <EmptyState
          title="Nenhuma empresa pronta para abordar."
          description="Você já abordou todas as que têm contato. Faça uma nova pesquisa para encontrar mais."
        >
          <Link href="/pesquisas" className={buttonStyles("primary")}>
            Nova pesquisa
          </Link>
          <Button onClick={() => setFilters(withStage(filters, "contacted"))}>Ver contatadas</Button>
        </EmptyState>
      );
    } else {
      empty = (
        <EmptyState title="Nenhuma empresa com esses filtros." description="Tire um filtro ou limpe todos.">
          {hasFilters && (
            <Button variant="primary" onClick={clearAll}>
              Limpar filtros
            </Button>
          )}
        </EmptyState>
      );
    }
    listBody = <div className="p-3">{empty}</div>;
  } else {
    listBody = (
      <>
        {leads.error && (
          <div className="p-3">
            <ErrorState message="Não consegui carregar as empresas." detail={leads.error} onRetry={leads.reload} />
          </div>
        )}
        {queueDone && (
          <div role="status" className="flex flex-wrap items-center gap-3 border-b border-line bg-hover px-4 py-3">
            <p className="flex-1 text-fg">Fila concluída. {formatNumber(contactedCount)} empresas já abordadas.</p>
            <Button
              size="sm"
              onClick={() => {
                setSelection({ kind: "none" });
                changeView({ ...view, page: 1 }, { kind: "page" });
                document.getElementById("lista-empresas")?.scrollTo({ top: 0 });
              }}
            >
              Voltar ao topo
            </Button>
          </div>
        )}
        <LeadRows
          items={items}
          selectedId={selectedId}
          tabFallbackId={lastRowId}
          showCity={cities.length >= 2}
          settings={outreach.data}
          busy={leads.loading}
          onOpen={(lead, focusMessage) => selectLead(lead, focusMessage ? "message" : null)}
          onMove={(delta) => move(delta, { focusList: true })}
          onHover={setHoverId}
          onSend={handleSend}
          onAddWhatsapp={(lead) => selectLead(lead, "whatsapp")}
        />
      </>
    );
  }

  const panorama = (
    <section aria-labelledby="panorama-titulo" className={cx(panelClass, "flex min-h-0 flex-col xl:flex-1")}>
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 px-4 max-md:h-12 xl:h-11">
        <h2 id="panorama-titulo" className="rotulo">
          Panorama
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 max-md:h-11 xl:hidden"
          aria-label={panoramaOpen ? "Recolher panorama" : "Abrir panorama"}
          aria-expanded={panoramaOpen}
          aria-controls="panorama-conteudo"
          onClick={() => setPanoramaOpen((v) => !v)}
        >
          {panoramaOpen ? "Recolher" : "Abrir"}
          <ChevronDownIcon className={cx("transition-transform", panoramaOpen && "rotate-180")} />
        </Button>
      </div>
      <div
        id="panorama-conteudo"
        className={cx("relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4", !panoramaOpen && "hidden", "xl:block")}
      >
        <Panorama
          stats={stats.data}
          error={stats.error}
          onRetry={stats.reload}
          filters={filters}
          onChange={changeFilters}
        />
      </div>
    </section>
  );

  return (
    <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_clamp(400px,32vw,480px)] xl:grid-rows-[auto_minmax(0,1fr)] xl:gap-x-6 desk:h-[calc(100dvh-48px)]">
      <p aria-live="polite" className="sr-only">
        {spoken}
      </p>

      {/* Topo */}
      <header className="flex min-h-12 items-center gap-2 xl:col-span-2 xl:min-h-14">
        <h1 className="min-w-0 flex-1 truncate font-display text-h2 font-semibold">
          Dashboard
          {recorte && <span className="font-sans text-corpo font-normal text-muted"> · {recorte}</span>}
        </h1>
        <SearchBox
          value={filters.q ?? ""}
          onCommit={(v) => changeFilters({ q: v.trim() || undefined })}
          className="hidden w-72 sm:block"
        />
        <ExportMenu filters={filters} meta={meta.data} total={total} compact={!wide} />
        <Link
          href="/pesquisas"
          aria-label="Nova pesquisa"
          className={buttonStyles("secondary", "md", "max-md:h-11 max-sm:w-11 max-sm:px-0")}
        >
          <PlusIcon />
          <span className="hidden sm:inline">Nova pesquisa</span>
        </Link>
      </header>

      {baseEmpty ? (
        <div className="xl:col-span-2">
          <EmptyState
            title="Nenhuma empresa por aqui ainda."
            description="Faça a primeira pesquisa e as empresas aparecem aqui, já com a nota de oportunidade."
          >
            <Link href="/pesquisas" className={buttonStyles("primary")}>
              <PlusIcon />
              Fazer primeira pesquisa
            </Link>
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Coluna da lista (no celular e tablet os blocos entram na ordem da tela) */}
          <div className="contents xl:flex xl:min-h-0 xl:flex-col xl:gap-3">
            <div className="order-1">
              <Funnel
                funnel={funnel}
                active={stage}
                loading={stats.loading}
                error={stats.error}
                onRetry={stats.reload}
                onStage={onStage}
                onLeak={onLeak}
                leakActive={leakActive}
              />
            </div>
            <div className="order-2">
              <FiltersBar
                filters={filters}
                meta={meta.data}
                searches={searches.data}
                total={total}
                onChange={changeFilters}
                onClearAll={clearAll}
              />
            </div>
            <section
              aria-labelledby="barra-lista"
              className={cx(panelClass, "order-5 flex flex-col overflow-hidden desk:min-h-0 desk:flex-1")}
            >
              <h2 id="barra-lista" tabIndex={-1} className="sr-only">
                Empresas
              </h2>
              <ListBar
                total={total}
                stageLabel={stageLabel(stage)}
                sort={view.sort}
                dir={view.dir}
                onSort={(field: LeadSort) =>
                  changeView({ ...view, sort: field, dir: field === view.sort ? view.dir : defaultDir(field), page: 1 })
                }
                onDir={() => changeView({ ...view, dir: view.dir === "asc" ? "desc" : "asc", page: 1 })}
                shortcutsOpen={shortcutsOpen}
                onShortcutsOpen={setShortcutsOpen}
                shortcutsEnabled={shortcutsEnabled}
                onShortcutsEnabled={setShortcutsEnabled}
              />
              {/* relative: o scroller contém os textos sr-only (posição absoluta) das linhas */}
              <div id="lista-empresas" className="relative desk:min-h-0 desk:flex-1 desk:overflow-y-auto desk:overscroll-contain">
                {listBody}
              </div>
              {items && items.length > 0 && (
                <Pagination
                  page={view.page}
                  pageSize={view.pageSize}
                  total={total ?? 0}
                  onPage={(page) => changeView({ ...view, page }, { kind: "page" })}
                  onPageSize={(pageSize) => changeView({ ...view, pageSize, page: 1 }, { kind: "page" })}
                />
              )}
            </section>
          </div>

          {/* Lateral: mapa-radar e, embaixo, o painel da empresa (≥ 1280) ou o Panorama */}
          <div className="contents xl:sticky xl:top-6 xl:flex xl:h-[calc(100dvh-48px)] xl:min-h-0 xl:flex-col xl:gap-3 xl:self-start desk:static desk:h-auto desk:self-stretch">
            <div className="order-3 xl:shrink-0">
              <RadarMap
                points={points}
                pointsKey={pointsPath}
                context={hasStage ? context.data : undefined}
                open={mapOpen}
                onToggle={toggleMap}
                listTotal={total}
                selectedId={selectedId}
                hoverId={hoverId}
                onSelect={openFromMap}
                onClearFilters={clearAll}
              />
            </div>
            <div className="order-4 flex min-h-0 flex-col xl:flex-1">
              {isXl && selected ? (
                <section
                  aria-label={`Empresa selecionada: ${selected.name}`}
                  className={cx(panelClass, "flex min-h-0 flex-1 flex-col overflow-hidden")}
                >
                  {panel}
                </section>
              ) : (
                panorama
              )}
            </div>
          </div>
        </>
      )}

      {!isXl && selected && (
        <Sheet id={LEAD_SHEET_ID} label={selected.name} onClose={closePanel}>
          {panel}
        </Sheet>
      )}
    </div>
  );
}
