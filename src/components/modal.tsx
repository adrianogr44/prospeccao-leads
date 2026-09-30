"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { CloseIcon } from "./icons";
import { buttonStyles } from "./ui";

/** Fecha o <dialog> que contém o elemento clicado. */
function closeFrom(event: MouseEvent<HTMLElement>) {
  event.currentTarget.closest("dialog")?.close();
}

/**
 * Diálogo nativo (<dialog>): foco preso, Esc e restauração de foco vêm do navegador.
 * O pai monta o componente para abrir e o desmonta em `onClose`.
 */
export function Modal({
  title,
  variant = "center",
  onClose,
  children,
}: {
  title: string;
  variant?: "center" | "drawer";
  onClose: () => void;
  children: ReactNode | ((close: (event: MouseEvent<HTMLElement>) => void) => ReactNode);
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className={cx(
        "border-line bg-canvas p-0 text-fg backdrop:bg-black/40 open:flex open:flex-col",
        variant === "center"
          ? "m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] rounded-lg border"
          : "m-0 ml-auto h-dvh max-h-none w-full max-w-lg rounded-none border-l",
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id={titleId} className="min-w-0 text-base font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={closeFrom}
          className={buttonStyles("ghost", "sm", "px-1.5")}
          aria-label="Fechar"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {typeof children === "function" ? children(closeFrom) : children}
      </div>
    </dialog>
  );
}
