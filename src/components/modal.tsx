"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { CloseIcon } from "./icons";
import { IconButton } from "./ui";

/** Fecha o <dialog> que contém o elemento clicado. */
function closeFrom(event: MouseEvent<HTMLElement>) {
  event.currentTarget.closest("dialog")?.close();
}

/**
 * Abre o <dialog> como modal ao montar (foco preso, Esc e restauração de foco vêm do navegador).
 * Depois de abrir, foca o elemento marcado com `data-autofocus` (ou o primeiro campo), para o navegador
 * não parar o foco na área rolável.
 */
function useShowModal() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    const target =
      dialog.querySelector<HTMLElement>("[data-autofocus]") ??
      dialog.querySelector<HTMLElement>("select, input, textarea, button, a[href]");
    target?.focus();
  }, []);
  return ref;
}

/**
 * Diálogo nativo. O pai monta o componente para abrir e o desmonta em `onClose`.
 * `center`: diálogo (vitrine, raio 14). `drawer`: gaveta à direita (muro, borda esquerda).
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
  const ref = useShowModal();
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className={cx(
        "p-0 text-fg open:flex open:flex-col",
        variant === "center"
          ? "anima-dialogo m-auto max-h-[calc(100dvh-2rem)] w-[min(440px,calc(100vw-32px))] rounded-panel bg-surface-3 shadow-elev-3"
          : "anima-gaveta m-0 ml-auto h-dvh max-h-none w-[min(480px,100vw)] max-w-none bg-surface-2 shadow-[-1px_0_0_var(--fio-forte)] light:shadow-elev-2",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <h2 id={titleId} className="min-w-0 font-display text-h2 font-semibold">
          {title}
        </h2>
        <IconButton label="Fechar" onClick={closeFrom} className="-mt-1 -mr-1 max-md:size-11">
          <CloseIcon />
        </IconButton>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 text-muted">
        {typeof children === "function" ? children(closeFrom) : children}
      </div>
    </dialog>
  );
}

/**
 * Folha sem cabeçalho próprio: o conteúdo desenha o seu.
 * `side`: gaveta à direita (tela cheia no celular). `bottom`: folha inferior de 80 % da altura.
 */
export function Sheet({
  id,
  label,
  side = "right",
  onClose,
  children,
  className,
}: {
  id?: string;
  /** Nome acessível do diálogo. */
  label: string;
  side?: "right" | "bottom";
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useShowModal();

  return (
    <dialog
      ref={ref}
      id={id}
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className={cx(
        "max-h-none max-w-none bg-surface-2 p-0 text-fg open:flex open:flex-col",
        side === "right"
          ? "anima-gaveta m-0 ml-auto h-dvh w-full shadow-[-1px_0_0_var(--fio-forte)] md:w-[min(480px,100vw)] light:shadow-elev-2"
          : "anima-folha mx-0 mt-auto mb-0 h-[80dvh] w-full rounded-t-panel shadow-elev-2",
        className,
      )}
    >
      {children}
    </dialog>
  );
}
