"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./icons";
import { buttonStyles } from "./ui";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");

export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => false);
}

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useIsDark();

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // armazenamento indisponível: o tema vale só nesta visita
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className={buttonStyles("ghost", "sm", className)}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
      <span>{dark ? "Tema claro" : "Tema escuro"}</span>
    </button>
  );
}
