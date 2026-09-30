"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useEffectEvent, useRef } from "react";
import type { LeadPoint } from "@/lib/contract";
import { usePrefersReducedMotion } from "@/lib/use-client-state";
import { thermoLabel } from "../lead-ui";
import { useIsDark } from "../theme-toggle";

// Mapa-radar (docs/design/visual-radar.md 4.6). Carregado sob demanda (next/dynamic, ssr: false).
// Pontos em L.canvas() com circleMarker; só o selecionado e o destacado viram divIcon (pulso em CSS).

export interface RadarMapApi {
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
  retryTiles: () => void;
}

export interface ZoomState {
  canZoomIn: boolean;
  canZoomOut: boolean;
}

interface Props {
  points: LeadPoint[];
  /** Camada de contexto ("poeira"): empresas dos filtros-base fora da etapa atual. Sem interação. */
  context: LeadPoint[] | null;
  /** Muda quando chega o resultado de um filtro novo: o mapa se enquadra nos pontos. */
  fitKey: string | null;
  selectedId: string | null;
  hoverId: string | null;
  onSelect: (id: string) => void;
  onReady: (api: RadarMapApi) => void;
  onTiles: (status: "ok" | "offline") => void;
  onMoved: (moved: boolean) => void;
  onZoom: (state: ZoomState) => void;
}

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a><span class="attr-longo"> contributors</span>';
const BRAZIL: L.LatLngTuple = [-14.2, -51.9];

const DIAMETER: Record<number, number> = { 5: 14, 4: 10, 3: 8, 2: 6, 1: 5 };
const OPACITY: Record<number, number> = { 5: 1, 4: 0.92, 3: 0.75, 2: 0.55, 1: 0.4 };

interface Palette {
  termo: Record<number, string>;
  letreiro: string;
  envio: string;
  envioAnel: string;
  poeira: string;
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    termo: { 5: v("--termo-5"), 4: v("--termo-4"), 3: v("--termo-3"), 2: v("--termo-2"), 1: v("--termo-1") },
    letreiro: v("--letreiro"),
    envio: v("--envio"),
    envioAnel: v("--envio-anel"),
    poeira: v("--tinta-4"),
  };
}

const levelOf = (p: LeadPoint) => Math.max(1, Math.min(5, Math.round(p.stars)));

function zoomScale(zoom: number): { scale: number; minD: number } {
  if (zoom >= 14) return { scale: 1, minD: 0 };
  if (zoom >= 12) return { scale: 0.8, minD: 0 };
  if (zoom >= 10) return { scale: 0.6, minD: 4 };
  return { scale: 0.4, minD: 3 };
}

/** Diâmetro na tela conforme o zoom (seção 4.6). */
function diameterAt(p: LeadPoint, zoom: number): number {
  const base = p.contacted ? 10 : DIAMETER[levelOf(p)];
  const { scale, minD } = zoomScale(zoom);
  return Math.max(minD, base * scale);
}

function opacityAt(level: number, zoom: number): number {
  const base = OPACITY[level];
  if (zoom >= 12) return base;
  if (zoom >= 10) return Math.max(0.2, base - 0.1);
  return level <= 3 ? 0.3 : Math.max(0.2, base - 0.1);
}

const glowAt = (level: number, zoom: number) => (zoom >= 12 ? level >= 4 : level === 5);

function addPoint(
  group: L.LayerGroup,
  renderer: L.Renderer,
  p: LeadPoint,
  zoom: number,
  palette: Palette,
  dark: boolean,
  onClick: (id: string) => void,
) {
  const at: L.LatLngTuple = [p.lat, p.lng];
  const r = diameterAt(p, zoom) / 2;
  const level = levelOf(p);
  const base = { renderer, interactive: false, stroke: false } as const;

  if (p.contacted) {
    const ring = L.circleMarker(at, {
      renderer,
      radius: r,
      color: palette.envioAnel,
      weight: 2,
      fillColor: palette.envio,
      fillOpacity: 0.14,
      interactive: true,
    });
    L.circleMarker(at, { ...base, radius: Math.max(1, r * 0.3), fillColor: palette.envioAnel, fillOpacity: 1 }).addTo(
      group,
    );
    ring.bindTooltip(`${p.name} · Contatada`, { direction: "top", offset: [0, -r], opacity: 1 });
    ring.on("click", () => onClick(p.id));
    ring.addTo(group);
    return;
  }

  if (dark && glowAt(level, zoom)) {
    // Brilho de letreiro: halo como segundo círculo (raio + 4), mais um véu largo no nível 5.
    if (level === 5) {
      L.circleMarker(at, { ...base, radius: r + 9, fillColor: palette.letreiro, fillOpacity: 0.07 }).addTo(group);
    }
    L.circleMarker(at, {
      ...base,
      radius: r + 4,
      fillColor: palette.letreiro,
      fillOpacity: level === 5 ? 0.18 : 0.12,
    }).addTo(group);
  }
  if (!dark) {
    // Claro: anel duplo (branco + contorno escuro) para o ponto se destacar do terreno.
    if (level === 5) {
      L.circleMarker(at, { ...base, radius: r + 3.5, fillColor: palette.termo[5], fillOpacity: 0.18 }).addTo(group);
    }
    L.circleMarker(at, { ...base, radius: r + 2, fillColor: "#121926", fillOpacity: 0.55 }).addTo(group);
  }

  const dot = L.circleMarker(at, {
    renderer,
    radius: r,
    stroke: !dark,
    color: "#ffffff",
    weight: 1.5,
    opacity: 1,
    fillColor: palette.termo[level],
    fillOpacity: opacityAt(level, zoom),
    interactive: true,
  });
  dot.bindTooltip(`${p.name} · ${thermoLabel(p.stars)} ${Math.round(p.score)}`, {
    direction: "top",
    offset: [0, -r],
    opacity: 1,
  });
  dot.on("click", () => onClick(p.id));
  dot.addTo(group);
}

function highlightIcon(p: LeadPoint, zoom: number, palette: Palette, kind: "sel" | "hover"): L.DivIcon {
  const d = Math.max(8, diameterAt(p, zoom) * 1.4);
  const color = p.contacted ? palette.envio : palette.termo[levelOf(p)];
  return L.divIcon({
    className: kind === "sel" ? "ponto-sel" : "ponto-hover",
    html: `<span style="--cor-ponto:${color}"></span>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
  });
}

export default function RadarMapCanvas({
  points,
  context,
  fitKey,
  selectedId,
  hoverId,
  onSelect,
  onReady,
  onTiles,
  onMoved,
  onZoom,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const liveRef = useRef<{ group: L.LayerGroup; renderer: L.Renderer } | null>(null);
  const dustRef = useRef<{ group: L.LayerGroup; renderer: L.Renderer } | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const selRef = useRef<L.Marker | null>(null);
  const hoverRef = useRef<L.Marker | null>(null);
  const lastFit = useRef<string | null>(null);
  const programmatic = useRef(false);
  const dark = useIsDark();
  const reduced = usePrefersReducedMotion();
  const isReduced = useEffectEvent(() => reduced);

  const pointsRef = useRef(points);
  const byId = useRef(new Map<string, LeadPoint>());

  const select = useEffectEvent((id: string) => onSelect(id));
  const reportTiles = useEffectEvent((status: "ok" | "offline") => onTiles(status));
  const reportMoved = useEffectEvent((moved: boolean) => onMoved(moved));
  const reportZoom = useEffectEvent((map: L.Map) =>
    onZoom({ canZoomIn: map.getZoom() < map.getMaxZoom(), canZoomOut: map.getZoom() > map.getMinZoom() }),
  );
  const ready = useEffectEvent((api: RadarMapApi) => onReady(api));

  /** Enquadra os pontos vivos (margem de 32 px). */
  const fit = useEffectEvent((animate: boolean) => {
    const map = mapRef.current;
    const list = pointsRef.current;
    if (!map || list.length === 0) return;
    programmatic.current = true;
    if (list.length === 1) {
      map.setView([list[0].lat, list[0].lng], 15, { animate: animate && !reduced });
    } else {
      const bounds = L.latLngBounds(list.map((p) => [p.lat, p.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16, animate: animate && !reduced });
    }
    reportMoved(false);
  });

  const drawLive = useEffectEvent(() => {
    const map = mapRef.current;
    const live = liveRef.current;
    if (!map || !live) return;
    live.group.clearLayers();
    const palette = readPalette();
    const zoom = map.getZoom();
    // Maior score por cima: desenha do menor para o maior.
    for (let i = pointsRef.current.length - 1; i >= 0; i--) {
      addPoint(live.group, live.renderer, pointsRef.current[i], zoom, palette, dark, (id) => select(id));
    }
  });

  const drawDust = useEffectEvent(() => {
    const dust = dustRef.current;
    if (!dust) return;
    dust.group.clearLayers();
    if (!context) return;
    const palette = readPalette();
    for (const p of context) {
      if (byId.current.has(p.id)) continue;
      L.circleMarker([p.lat, p.lng], {
        renderer: dust.renderer,
        radius: 1.5,
        stroke: false,
        fillColor: palette.poeira,
        fillOpacity: 0.5,
        interactive: false,
      }).addTo(dust.group);
    }
  });

  const drawHighlights = useEffectEvent(() => {
    const map = mapRef.current;
    if (!map) return;
    const palette = readPalette();
    const zoom = map.getZoom();
    selRef.current?.remove();
    selRef.current = null;
    hoverRef.current?.remove();
    hoverRef.current = null;
    const sel = selectedId ? byId.current.get(selectedId) : undefined;
    if (sel) {
      selRef.current = L.marker([sel.lat, sel.lng], {
        icon: highlightIcon(sel, zoom, palette, "sel"),
        interactive: false,
        keyboard: false,
        zIndexOffset: 10_000,
      }).addTo(map);
    }
    const hover = hoverId && hoverId !== selectedId ? byId.current.get(hoverId) : undefined;
    if (hover) {
      hoverRef.current = L.marker([hover.lat, hover.lng], {
        icon: highlightIcon(hover, zoom, palette, "hover"),
        interactive: false,
        keyboard: false,
        zIndexOffset: 9_000,
      }).addTo(map);
    }
  });

  /** Desloca o mapa (sem mudar o zoom) quando o ponto está fora da vista. */
  const reveal = useEffectEvent((id: string | null) => {
    const map = mapRef.current;
    const p = id ? byId.current.get(id) : undefined;
    if (!map || !p) return;
    const at = L.latLng(p.lat, p.lng);
    if (map.getBounds().pad(-0.08).contains(at)) return;
    programmatic.current = true;
    map.panTo(at, { animate: !reduced, duration: 0.45 });
  });

  // Montagem: mapa, camadas e eventos.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const reduced = isReduced();
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      keyboard: true,
      zoomSnap: 1,
      minZoom: 3,
      maxZoom: 18,
      fadeAnimation: !reduced,
      zoomAnimation: !reduced,
      markerZoomAnimation: !reduced,
    }).setView(BRAZIL, 4);
    map.attributionControl.setPrefix(false);
    map.getContainer().setAttribute("aria-label", "Mapa das empresas. Use as setas para mover e + ou − para o zoom.");

    const dustPane = map.createPane("poeira");
    dustPane.style.zIndex = "390";
    const livePane = map.createPane("pontos");
    livePane.style.zIndex = "400";

    const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION });
    let loaded = 0;
    tiles.on("tileload", () => {
      loaded += 1;
      reportTiles("ok");
    });
    tiles.on("tileerror", () => {
      if (loaded === 0) reportTiles("offline");
    });
    tiles.addTo(map);
    if (typeof navigator !== "undefined" && navigator.onLine === false) reportTiles("offline");

    const dustRenderer = L.canvas({ pane: "poeira", padding: 0.5 });
    const liveRenderer = L.canvas({ pane: "pontos", padding: 0.5, tolerance: 4 });
    dustRef.current = { group: L.layerGroup().addTo(map), renderer: dustRenderer };
    liveRef.current = { group: L.layerGroup().addTo(map), renderer: liveRenderer };
    mapRef.current = map;
    tilesRef.current = tiles;

    map.on("zoomend", () => {
      drawLive();
      drawHighlights();
      reportZoom(map);
    });
    map.on("movestart", () => {
      if (!programmatic.current) reportMoved(true);
    });
    map.on("moveend", () => {
      programmatic.current = false;
    });

    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(el);

    ready({
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      recenter: () => fit(true),
      retryTiles: () => {
        loaded = 0;
        tiles.redraw();
      },
    });
    reportZoom(map);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      liveRef.current = null;
      dustRef.current = null;
      tilesRef.current = null;
      selRef.current = null;
      hoverRef.current = null;
    };
  }, []);

  // Pontos vivos, tema: redesenha tudo.
  useEffect(() => {
    pointsRef.current = points;
    byId.current = new Map(points.map((p) => [p.id, p]));
    drawLive();
    drawDust();
    drawHighlights();
  }, [points, dark]);

  useEffect(() => {
    drawDust();
  }, [context, dark]);

  // Filtro novo com resultado: enquadra.
  useEffect(() => {
    if (fitKey === null || fitKey === lastFit.current || points.length === 0) return;
    const first = lastFit.current === null;
    lastFit.current = fitKey;
    fit(!first);
  }, [fitKey, points]);

  useEffect(() => {
    drawHighlights();
    reveal(selectedId);
  }, [selectedId]);

  useEffect(() => {
    drawHighlights();
    if (hoverId) reveal(hoverId);
  }, [hoverId]);

  return <div ref={container} className="absolute inset-0" />;
}
