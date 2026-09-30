"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, errorMessage, isAbortError } from "./api";

interface State<T> {
  key: string;
  data?: T;
  error?: string;
}

export interface ApiResource<T> {
  data: T | undefined;
  error: string | null;
  /** true enquanto a requisição atual não respondeu (data mantém o valor anterior) */
  loading: boolean;
  reload: () => void;
  mutate: (update: (current: T | undefined) => T | undefined) => void;
}

/**
 * GET tipado com cancelamento de requisições obsoletas.
 * `path = null` deixa o hook parado. `pollMs` repete a busca sem piscar o estado de carregamento, enquanto `pollWhile` (se houver) for verdadeiro.
 */
export function useApiGet<T>(path: string | null, options: { pollMs?: number; pollWhile?: (data: T | undefined) => boolean } = {}): ApiResource<T> {
  const { pollMs, pollWhile } = options;
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State<T>>({ key: "" });
  const polling = pollMs !== undefined && (pollWhile ? pollWhile(state.data) : true);
  const key = path === null ? "" : `${nonce}|${path}`;

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    const run = () => {
      apiGet<T>(path, controller.signal)
        .then((data) => setState({ key, data }))
        .catch((error: unknown) => {
          if (isAbortError(error)) return;
          setState((prev) => ({ key, data: prev.data, error: errorMessage(error) }));
        });
    };
    run();
    const timer = polling ? setInterval(run, pollMs) : undefined;
    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [key, path, polling, pollMs]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const mutate = useCallback(
    (update: (current: T | undefined) => T | undefined) =>
      setState((prev) => ({ ...prev, data: update(prev.data) })),
    [],
  );

  return {
    data: state.data,
    error: path !== null && state.key === key ? (state.error ?? null) : null,
    loading: path !== null && state.key !== key,
    reload,
    mutate,
  };
}
