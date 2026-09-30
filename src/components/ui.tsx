import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { AlertIcon } from "./icons";

// ---------- Botões ----------

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";
export type ButtonSize = "sm" | "md";

const variants: Record<ButtonVariant, string> = {
  primary: "border-accent bg-accent text-canvas hover:opacity-90",
  secondary: "border-line bg-canvas text-fg hover:bg-surface",
  ghost: "border-transparent text-muted hover:bg-surface hover:text-fg",
  danger: "border-danger bg-canvas text-danger hover:bg-surface",
  "danger-solid": "border-danger bg-danger text-canvas hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-9 px-3 text-sm",
};

export function buttonStyles(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonStyles(variant, size, className)} {...props} />;
}

// ---------- Formulários ----------

export const inputClass =
  "h-9 w-full rounded-md border border-line bg-canvas px-2.5 text-sm text-fg placeholder:text-muted disabled:opacity-50 aria-[invalid=true]:border-danger";

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
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------- Estrutura ----------

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
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 max-w-prose text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Section({
  title,
  srOnlyTitle = false,
  actions,
  children,
  className,
}: {
  title: string;
  srOnlyTitle?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mb-6", className)}>
      <div className={cx("mb-2 flex items-center justify-between gap-2", srOnlyTitle && "sr-only")}>
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

// ---------- Estados ----------

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded bg-line/70", className)} />;
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 px-4 py-3"
    >
      <AlertIcon className="size-4 shrink-0 text-danger" />
      <p className="min-w-0 flex-1 text-danger">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}

// ---------- Etiquetas ----------

export type BadgeTone = "neutral" | "accent" | "warn" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line text-muted",
  accent: "border-accent/40 text-accent",
  warn: "border-warn/40 text-warn",
  danger: "border-danger/40 text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
