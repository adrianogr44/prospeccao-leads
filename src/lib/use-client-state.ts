"use client";

import { useCallback, useSyncExternalStore } from "react";

/** `matchMedia` como estado. No servidor (e na hidratação) vale `serverValue`. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

// ---------- Preferências do navegador (conveniência; a tela funciona sem elas) ----------

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function readPref(key: string): string | null {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // armazenamento bloqueado: usa a memória desta visita
  }
  return memory.get(key) ?? null;
}

function subscribePrefs(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setPref(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // idem
  }
  for (const listener of listeners) listener();
}

/** Valor guardado no navegador, ou null (também no servidor). */
export function usePref(key: string): string | null {
  return useSyncExternalStore(
    subscribePrefs,
    () => readPref(key),
    () => null,
  );
}
