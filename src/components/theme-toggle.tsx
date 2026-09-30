"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cx } from "@/lib/cx";
import { MoonIcon, SunIcon } from "./icons";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** Escuro é o padrão: só o claro é marcado com a classe `light`. */
const isDark = () => !document.documentElement.classList.contains("light");

export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => true);
}

/** Cor da barra do navegador (celular) acompanha o tema do app, que não é o do sistema. */
const THEME_COLOR = { dark: "#0d1116", light: "#f2f4f7" } as const;

export function setTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // armazenamento indisponível: o tema vale só nesta visita
  }
}

/**
 * Alternador de tema. `rail`: ícone com rótulo embaixo (trilho de 88 px); `icon`: só o ícone (barra do celular).
 */
export function ThemeToggle({ variant = "rail", className }: { variant?: "rail" | "icon"; className?: string }) {
  const dark = useIsDark();
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>("meta[name=theme-color]");
    if (meta) meta.content = dark ? THEME_COLOR.dark : THEME_COLOR.light;
  }, [dark]);
  const label = dark ? "Tema claro" : "Tema escuro";
  const Icon = dark ? SunIcon : MoonIcon;

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={variant === "icon" ? `Usar ${label.toLowerCase()}` : undefined}
      title={`Usar ${label.toLowerCase()}`}
      className={cx(
        "inline-flex items-center justify-center rounded-control text-muted transicao pressiona hover:bg-hover hover:text-fg",
        variant === "rail" ? "w-[72px] flex-col gap-1 py-2" : "size-11",
        className,
      )}
    >
      <Icon className={variant === "rail" ? "size-5" : "size-5"} />
      {variant === "rail" && <span className="font-display text-legenda font-medium">{label}</span>}
    </button>
  );
}
