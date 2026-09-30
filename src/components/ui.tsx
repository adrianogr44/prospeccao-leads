import { useId, type ComponentPropsWithRef, type ReactNode, type Ref } from "react";
import { cx } from "@/lib/cx";
import { AlertIcon, CheckIcon, CloseIcon, RadarVazio, SpinnerIcon } from "./icons";

// Fonte única de estilo dos controles (docs/design/visual-radar.md, seção 4).

// ---------- Botões ----------

export type ButtonVariant = "send" | "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
export type ButtonSize = "sm" | "md";

const buttonBase =
  "inline-flex shrink-0 items-center justify-center rounded-control border font-semibold whitespace-nowrap select-none transicao pressiona [&_svg]:size-4 [&_svg]:shrink-0 aria-busy:pointer-events-none";

/** Desabilitado (todas as variantes exceto fantasma): fundo apagado, texto tinta-4, sem hover nem escala. */
const disabledSolid = "disabled:cursor-not-allowed disabled:border-line-soft disabled:bg-disabled disabled:text-faint";

const variants: Record<ButtonVariant, string> = {
  send: cx(
    "border-[var(--envio-borda)] bg-send text-send-fg not-disabled:hover:bg-[var(--envio-hover)] not-disabled:active:bg-[var(--envio-ativo)]",
    disabledSolid,
  ),
  primary: cx(
    "border-transparent bg-primary text-primary-fg not-disabled:hover:bg-[var(--primario-hover)] not-disabled:active:bg-[var(--primario-ativo)]",
    disabledSolid,
  ),
  secondary: cx(
    "border-line-strong bg-hover text-fg not-disabled:hover:bg-selected not-disabled:active:border-control-line not-disabled:active:bg-selected",
    disabledSolid,
  ),
  ghost:
    "border-transparent bg-transparent text-muted not-disabled:hover:bg-hover not-disabled:hover:text-fg not-disabled:active:bg-selected disabled:cursor-not-allowed disabled:text-faint",
  danger: cx(
    "border-[color-mix(in_srgb,var(--pino)_45%,transparent)] bg-transparent text-danger not-disabled:hover:bg-pin-soft not-disabled:active:border-pin not-disabled:active:bg-pin-soft",
    disabledSolid,
  ),
  "danger-solid": cx(
    "border-transparent bg-[var(--pino-solido)] text-[var(--sobre-pino)] not-disabled:hover:bg-[var(--pino-solido-hover)] not-disabled:active:bg-[var(--pino-solido-ativo)]",
    disabledSolid,
  ),
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-botao",
  md: "h-9 gap-2 px-3.5 text-botao-md",
};

export function buttonStyles(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cx(buttonBase, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  loading = false,
  icon,
  children,
  ...props
}: ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra o spinner no lugar do ícone e bloqueia cliques, mantendo o texto. */
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      className={buttonStyles(variant, size, className)}
      {...props}
    >
      {loading ? <SpinnerIcon /> : icon}
      {children}
    </button>
  );
}

export type IconButtonSize = 28 | 32 | 36 | 44;

const iconSizes: Record<IconButtonSize, string> = {
  28: "size-7 alvo",
  32: "size-8",
  36: "size-9",
  44: "size-11",
};

/** Botão só de ícone. O nome acessível é obrigatório. */
export function IconButton({
  label,
  variant = "ghost",
  size = 32,
  className,
  type = "button",
  children,
  ...props
}: Omit<ComponentPropsWithRef<"button">, "aria-label"> & {
  label: string;
  variant?: ButtonVariant;
  size?: IconButtonSize;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(buttonBase, variants[variant], iconSizes[size], "p-0", className)}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------- Formulários ----------

/** Input, select e textarea: fundo inset (ctl-bg), borda translúcida composta sobre a superfície-mãe. */
export const inputClass = cx(
  "campo h-9 w-full rounded-control border border-control-line bg-control bg-clip-padding px-3 text-corpo text-fg transicao",
  "placeholder:text-subtle hover:border-control-line-hover",
  "focus:border-focus focus:shadow-[0_0_0_3px_var(--ctl-anel)] focus:outline-none",
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-faint",
  "aria-[invalid=true]:border-pin",
);

/** Base das áreas de texto: a altura mínima vem de quem usa (`textareaClass` 160 px; `textareaCompactClass` 2 linhas). */
const textareaBase = cx(inputClass, "h-auto px-3 py-2.5 text-corpo leading-5");

export const textareaClass = cx(textareaBase, "min-h-40");

export const textareaCompactClass = cx(textareaBase, "min-h-16 resize-y");

export const labelClass = "mb-1.5 block text-legenda font-medium text-muted";

/** Grade de 6 colunas dos formulários de pesquisa: o pai define a largura, os campos escolhem o `col-span-*`. */
export const formGridClass = "grid grid-cols-6 gap-x-3 gap-y-4";

/** Caixa de seleção: 16 × 16, raio 4, marcada em neutro (nunca âmbar nem verde). O rótulo inteiro é clicável. */
export function Checkbox({
  children,
  className,
  ...props
}: Omit<ComponentPropsWithRef<"input">, "type" | "children"> & { children: ReactNode }) {
  return (
    <label className={cx("inline-flex min-h-8 cursor-pointer items-start gap-2.5 py-1 text-corpo", className)}>
      <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          className="peer size-4 cursor-pointer appearance-none rounded-badge border border-control-line bg-control bg-clip-padding transicao hover:border-control-line-hover checked:border-primary checked:bg-primary"
          {...props}
        />
        <CheckIcon className="pointer-events-none absolute size-3 text-primary-fg opacity-0 transicao peer-checked:opacity-100" />
      </span>
      <span>{children}</span>
    </label>
  );
}

/** Chave liga/desliga. O nome acessível (`label`) é obrigatório; o texto visível (`children`) mostra o estado. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
  children,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cx(
        "group inline-flex h-9 shrink-0 items-center gap-2 rounded-control text-botao font-medium text-muted transicao disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full transicao",
          checked
            ? "bg-primary"
            : "bg-control shadow-[inset_0_0_0_1px_var(--ctl-borda)] group-hover:shadow-[inset_0_0_0_1px_var(--ctl-borda-hover)]",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 size-4 rounded-full transition-transform duration-150 ease-(--ease-saida)",
            checked ? "translate-x-4 bg-primary-fg" : "bg-subtle",
          )}
        />
      </span>
      {children}
    </button>
  );
}

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-legenda text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 flex items-start gap-1 text-legenda text-danger">
          <AlertIcon className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ---------- Estrutura ----------

/** Painel de nível 1 (calçada + anel). */
export const panelClass = "rounded-panel bg-surface shadow-elev-1";

/** Cartão de item de lista (raio 10). `raised` sobe o anel um degrau: destaca o item que está em andamento. */
export function cardStyles(raised = false, className?: string): string {
  return cx("rounded-card bg-surface", raised ? "shadow-elev-2" : "shadow-elev-1", className);
}

/** Aviso que não é erro: filete âmbar à esquerda e ícone; o texto fica em `muted`. */
export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="note"
      className={cx(
        "flex items-start gap-2 rounded-card bg-hover px-3 py-2 text-muted shadow-[inset_2px_0_0_var(--letreiro),inset_0_0_0_1px_var(--fio)]",
        className,
      )}
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0 text-warn" />
      <p>{children}</p>
    </div>
  );
}

export type ProgressState = "queued" | "running" | "paused" | "failed";

const progressFill: Record<ProgressState, string> = {
  queued: "bg-subtle",
  running: "bg-primary",
  paused: "bg-subtle",
  failed: "bg-pin",
};

/**
 * Barra de progresso de pesquisa: trilho de 6 px e, acima, legenda à esquerda e percentual à direita.
 * Em fila não há percentual: um segmento de 30 % corre pelo trilho. O preenchimento se move por `transform`.
 */
export function ProgressBar({
  value,
  state,
  label,
  caption,
}: {
  /** 0 a 100 (ignorado em fila). */
  value: number;
  state: ProgressState;
  /** Nome acessível da barra. */
  label: string;
  caption: string;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  const queued = state === "queued";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-legenda text-muted">{caption}</span>
        {!queued && <span className="font-display text-botao font-semibold tabular-nums">{percent}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={queued ? undefined : percent}
        aria-valuetext={queued ? "Na fila" : `${percent}%`}
        className="relative h-1.5 overflow-hidden rounded-full bg-selected"
      >
        {queued ? (
          <div className={cx("progresso-fila h-full rounded-full", progressFill[state])} />
        ) : (
          <div
            className={cx(
              "h-full w-full rounded-full transition-transform duration-300 ease-(--ease-mov)",
              progressFill[state],
            )}
            style={{ transform: `translateX(${percent - 100}%)` }}
          />
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-h1 font-semibold tracking-titulo">{title}</h1>
        {description && <p className="mt-1 max-w-[60ch] text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

/** Bloco com rótulo de seção (h2) e ações à direita; o espaço entre blocos é do pai. */
export function Section({
  title,
  srOnlyTitle = false,
  actions,
  headingRef,
  children,
  className,
}: {
  title: string;
  srOnlyTitle?: boolean;
  actions?: ReactNode;
  /** Quando informado, o título aceita foco por código (ex.: depois de excluir um item da lista). */
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={className}>
      <div className={cx("mb-3 flex min-h-8 items-center justify-between gap-2", srOnlyTitle && "sr-only")}>
        <h2 id={headingId} ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="rotulo">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

// ---------- Estados ----------

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("esqueleto", className)} />;
}

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <span role={label ? "status" : undefined} className={cx("inline-flex items-center gap-2", className)}>
      <SpinnerIcon className="size-4" />
      {label && <span className="text-legenda text-subtle">{label}</span>}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  children,
  compact = false,
  className,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Sem a ilustração grande (áreas estreitas). */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-3 rounded-panel border border-dashed border-line-strong px-4 py-10 text-center",
        className,
      )}
    >
      {!compact && <RadarVazio className="size-24" />}
      <div className="space-y-1">
        <p className="font-display text-h2 font-semibold">{title}</p>
        {description && <p className="mx-auto max-w-[40ch] text-muted">{description}</p>}
      </div>
      {children && <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  detail,
  onRetry,
  className,
}: {
  message: string;
  /** Mensagem técnica (da API), em texto menor. */
  detail?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cx(
        "flex flex-wrap items-center gap-3 rounded-card bg-pin-soft px-4 py-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--pino)_35%,transparent)]",
        className,
      )}
    >
      <AlertIcon className="size-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="text-fg">{message}</p>
        {detail && detail !== message && <p className="text-legenda text-muted">{detail}</p>}
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

// ---------- Etiquetas ----------

export type BadgeTone = "neutral" | "accent" | "warn" | "danger" | "sent";

const tones: Record<BadgeTone, string> = {
  neutral: "text-muted shadow-[inset_0_0_0_1px_var(--fio-forte)]",
  accent: "bg-amber-soft text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--letreiro)_35%,transparent)]",
  warn: "text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--letreiro)_40%,transparent)]",
  danger: "bg-pin-soft text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--pino)_35%,transparent)]",
  sent: "bg-sent-soft text-sent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--envio)_30%,transparent)]",
};

export const badgeBase =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-badge px-1.5 text-legenda font-medium tracking-legenda whitespace-nowrap";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cx(badgeBase, tones[tone])}>{children}</span>;
}

/** Chip de filtro ativo: "Chave: valor" + botão ×. */
export function Chip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 max-w-full shrink-0 items-center gap-1 rounded-full bg-hover pr-1 pl-2.5 text-botao shadow-[inset_0_0_0_1px_var(--fio-forte)]">
      <span className="truncate">
        <span className="text-subtle">{label}:</span> <span className="font-medium text-fg">{value}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${label}: ${value}`}
        className="alvo inline-flex size-5 shrink-0 items-center justify-center rounded-full text-subtle transicao hover:bg-selected hover:text-fg"
      >
        <CloseIcon className="size-3" />
      </button>
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-badge px-1 font-sans text-legenda font-medium text-subtle shadow-[inset_0_0_0_1px_var(--fio-forte)]">
      {children}
    </kbd>
  );
}
