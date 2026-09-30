const numberFormat = new Intl.NumberFormat("pt-BR");
const decimalFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dayMonthFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "30/09" */
export function formatDayMonth(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dayMonthFormat.format(date);
}

/** "14:32" */
export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : timeFormat.format(date);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatRating(value: number): string {
  return decimalFormat.format(value);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** "(19) 99251-1961"; sem DDD reconhecível, devolve como veio. */
export function formatPhone(value: string): string {
  let digits = onlyDigits(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

export function whatsappUrl(value: string): string {
  return `https://wa.me/${onlyDigits(value)}`;
}

export function instagramUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://instagram.com/${value.replace(/^@/, "")}`;
}

export function externalUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function hostOf(value: string): string {
  try {
    return new URL(externalUrl(value)).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
