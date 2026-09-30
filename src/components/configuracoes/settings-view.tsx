"use client";

import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { errorMessage, outreachSettingsPath, saveOutreachSettings } from "@/lib/api";
import {
  outreachSettingsSchema,
  SITE_STATUSES,
  SITE_STATUS_LABEL,
  type OutreachSettings,
  type SiteStatus,
} from "@/lib/contract";
import { cx } from "@/lib/cx";
import {
  buildOutreachMessage,
  DEFAULT_OUTREACH_SETTINGS,
  formatPrice,
  hostingCostSummary,
  OUTREACH_PLACEHOLDERS,
  planMargin,
  type OutreachLead,
} from "@/lib/outreach";
import { useApiGet } from "@/lib/use-api";
import { AlertIcon, ChevronDownIcon, CheckIcon, CloseIcon, PlusIcon, TrashIcon } from "../icons";
import { Sheet } from "../modal";
import {
  Button,
  Checkbox,
  ErrorState,
  Field,
  IconButton,
  inputClass,
  panelClass,
  Skeleton,
  textareaClass,
  textareaCompactClass,
} from "../ui";

// ---------- Rascunho do formulário (números como texto, para digitar à vontade) ----------

interface Draft {
  companyName: string;
  senderName: string;
  deliveryDays: string;
  includeHostingAndDomain: boolean;
  hosting: { provider: string; monthlyPrice: string; renewalMonthlyPrice: string; url: string };
  domain: { label: string; yearlyPrice: string };
  plans: Array<{ name: string; price: string; description: string }>;
  template: string;
}

const num = (n: number) => String(n).replace(".", ",");
// Texto vazio ou inválido vira NaN, que o schema recusa com mensagem clara.
const parseNum = (text: string) => (text.trim() === "" ? Number.NaN : Number(text.trim().replace(",", ".")));

function toDraft(s: OutreachSettings): Draft {
  return {
    companyName: s.companyName,
    senderName: s.senderName,
    deliveryDays: String(s.deliveryDays),
    includeHostingAndDomain: s.includeHostingAndDomain,
    hosting: {
      provider: s.hosting.provider,
      monthlyPrice: num(s.hosting.monthlyPrice),
      renewalMonthlyPrice: num(s.hosting.renewalMonthlyPrice),
      url: s.hosting.url,
    },
    domain: { label: s.domain.label, yearlyPrice: num(s.domain.yearlyPrice) },
    plans: s.plans.map((p) => ({ name: p.name, price: num(p.price), description: p.description })),
    template: s.template,
  };
}

function fromDraft(d: Draft): unknown {
  return {
    companyName: d.companyName,
    senderName: d.senderName,
    deliveryDays: parseNum(d.deliveryDays),
    includeHostingAndDomain: d.includeHostingAndDomain,
    hosting: {
      provider: d.hosting.provider,
      monthlyPrice: parseNum(d.hosting.monthlyPrice),
      renewalMonthlyPrice: parseNum(d.hosting.renewalMonthlyPrice),
      url: d.hosting.url,
    },
    domain: { label: d.domain.label, yearlyPrice: parseNum(d.domain.yearlyPrice) },
    plans: d.plans.map((p) => ({ name: p.name, price: parseNum(p.price), description: p.description })),
    template: d.template,
  };
}

type Errors = Record<string, string>;

function toErrors(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>): Errors {
  const next: Errors = {};
  for (const issue of issues) next[issue.path.join(".")] ??= issue.message;
  return next;
}

/** Id do campo que corresponde a cada caminho de erro do schema. */
const FIELD_ID: Record<string, string> = {
  companyName: "s-company",
  senderName: "s-sender",
  deliveryDays: "s-days",
  "hosting.provider": "s-host-provider",
  "hosting.monthlyPrice": "s-host-monthly",
  "hosting.renewalMonthlyPrice": "s-host-renewal",
  "hosting.url": "s-host-url",
  "domain.label": "s-domain-label",
  "domain.yearlyPrice": "s-domain-price",
  template: "s-template",
};

function errorFieldId(path: string): string | undefined {
  const plan = /^plans\.(\d+)\.(name|price|description)$/.exec(path);
  if (plan) return `s-plan-${plan[2] === "description" ? "desc" : plan[2]}-${plan[1]}`;
  return FIELD_ID[path];
}

/** Leva o foco ao primeiro campo (na ordem da tela) que tem erro. */
function focusFirstFieldError(form: HTMLFormElement, errors: Errors) {
  const ids = new Set(Object.keys(errors).map(errorFieldId));
  for (const element of Array.from(form.elements)) {
    if (element.id && ids.has(element.id) && element instanceof HTMLElement) {
      element.focus();
      return;
    }
  }
}

// ---------- Prévia ----------

const SAMPLE: Omit<OutreachLead, "siteStatus"> = {
  name: "Padaria Bom Pão",
  category: "padaria",
  city: "Aracaju",
  source: "google",
  whatsapp: null,
  phone: null,
  phoneIsMobile: false,
  email: null,
};

const PREVIEW_HINT = "Com uma empresa de exemplo (Padaria Bom Pão, Aracaju).";

/** Seletor da situação do site e a mensagem pronta, como chegaria ao cliente. Serve ao painel fixo e à folha do celular. */
function PreviewBody({
  idPrefix,
  status,
  onStatus,
  message,
}: {
  idPrefix: string;
  status: SiteStatus;
  onStatus: (next: SiteStatus) => void;
  message: string | null;
}) {
  return (
    <>
      <Field id={`${idPrefix}-status`} label="Situação do site da empresa de exemplo">
        {(control) => (
          <select
            {...control}
            value={status}
            onChange={(event) => {
              const next = SITE_STATUSES.find((s) => s === event.target.value);
              if (next) onStatus(next);
            }}
            className={inputClass}
          >
            {SITE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SITE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {message !== null ? (
          <div className="rounded-card rounded-tl-badge bg-control p-3 shadow-[inset_0_0_0_1px_var(--fio)]">
            <p className="text-corpo whitespace-pre-wrap text-fg">{message}</p>
          </div>
        ) : (
          <p className="text-muted">Corrija os campos com problema para ver a prévia.</p>
        )}
      </div>
    </>
  );
}

// ---------- Peças ----------

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cx(panelClass, "p-5")}>
      <h2 id={id} className="font-display text-h2 font-semibold">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  inputMode,
  rows,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  inputMode?: "decimal" | "numeric" | "url";
  /** Com valor, vira área de texto com essa quantidade de linhas. */
  rows?: number;
  className?: string;
}) {
  return (
    <Field id={id} label={label} error={error} hint={hint} className={className}>
      {(control) =>
        rows ? (
          <textarea
            {...control}
            value={value}
            rows={rows}
            onChange={(event) => onChange(event.target.value)}
            className={textareaCompactClass}
          />
        ) : (
          <input
            {...control}
            value={value}
            inputMode={inputMode}
            autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
          />
        )
      }
    </Field>
  );
}

function CostSummary({ draft }: { draft: Draft }) {
  const monthly = parseNum(draft.hosting.monthlyPrice);
  const renewalMonthly = parseNum(draft.hosting.renewalMonthlyPrice);
  const yearly = parseNum(draft.domain.yearlyPrice);
  if ([monthly, renewalMonthly, yearly].some(Number.isNaN)) return null;

  const cost = {
    hosting: { provider: "", url: "", monthlyPrice: monthly, renewalMonthlyPrice: renewalMonthly },
    domain: { label: "", yearlyPrice: yearly },
  };
  const { firstYear, renewal } = hostingCostSummary(cost);

  return (
    <div className="rounded-card bg-hover p-4 shadow-[inset_0_0_0_1px_var(--fio)]">
      <dl className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
        <div>
          <dt className="rotulo">Custo do primeiro ano</dt>
          <dd className="mt-1 font-display text-h2 font-semibold tabular-nums">{formatPrice(firstYear)}</dd>
          <dd className="text-legenda text-subtle">
            12 × {formatPrice(monthly)} + {formatPrice(yearly)}
          </dd>
        </div>
        <div>
          <dt className="rotulo">Renovação, do segundo ano em diante</dt>
          <dd className="mt-1 font-display text-h2 font-semibold tabular-nums">{formatPrice(renewal)}/ano</dd>
          <dd className="text-legenda text-subtle">
            12 × {formatPrice(renewalMonthly)} + {formatPrice(yearly)}
          </dd>
        </div>
      </dl>

      {draft.includeHostingAndDomain && draft.plans.length > 0 && (
        <div className="mt-4 border-t border-line-soft pt-3">
          <h3 className="rotulo mb-2">Sobra por venda</h3>
          <ul className="space-y-2">
            {draft.plans.map((plan, index) => {
              const price = parseNum(plan.price);
              if (Number.isNaN(price)) return null;
              const margin = planMargin(price, cost);
              const name = plan.name.trim() || `Plano ${index + 1}`;
              const covers = margin > 0;
              return (
                <li key={index} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{name}</p>
                    {covers ? (
                      <p className="text-legenda text-subtle">
                        {formatPrice(price)} − {formatPrice(firstYear)} de custo do primeiro ano
                      </p>
                    ) : (
                      <p role="alert" className="flex items-start gap-1 text-legenda text-danger">
                        <AlertIcon className="mt-px size-3.5 shrink-0" />
                        Este plano não cobre o custo de hospedagem e domínio ({formatPrice(price)} −{" "}
                        {formatPrice(firstYear)} = {formatPrice(margin)}).
                      </p>
                    )}
                  </div>
                  <p
                    className={cx(
                      "shrink-0 font-display text-numero font-semibold tabular-nums",
                      covers ? "text-fg" : "text-danger",
                    )}
                  >
                    {formatPrice(margin)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Formulário ----------

function SettingsForm({ initial, onSaved }: { initial: OutreachSettings; onSaved: (s: OutreachSettings) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  // Depois da primeira tentativa de salvar, os erros acompanham o que se digita e somem quando corrigidos.
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "restored">("idle");
  const [previewStatus, setPreviewStatus] = useState<SiteStatus>("NONE");
  const [sheetOpen, setSheetOpen] = useState(false);

  const parsed = useMemo(() => outreachSettingsSchema.safeParse(fromDraft(draft)), [draft]);
  const preview = parsed.success ? buildOutreachMessage({ ...SAMPLE, siteStatus: previewStatus }, parsed.data) : null;
  const errors: Errors = attempted && !parsed.success ? toErrors(parsed.error.issues) : {};
  const invalid = Object.keys(errors).length > 0;

  function change(update: (d: Draft) => Draft) {
    setDraft(update);
    setStatus("idle");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving") return;
    const form = event.currentTarget;
    setFailure(null);
    setAttempted(true);
    if (!parsed.success) {
      focusFirstFieldError(form, toErrors(parsed.error.issues));
      return;
    }
    setStatus("saving");
    try {
      onSaved(await saveOutreachSettings(parsed.data));
      setStatus("saved");
    } catch (e) {
      setStatus("idle");
      setFailure(errorMessage(e));
    }
  }

  function restore() {
    setDraft(toDraft(DEFAULT_OUTREACH_SETTINGS));
    setAttempted(false);
    setFailure(null);
    setStatus("restored");
  }

  const updatePlan = (index: number, patch: Partial<Draft["plans"][number]>) =>
    change((d) => ({ ...d, plans: d.plans.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));

  const hasAlert = failure !== null || invalid;
  const hasNote = hasAlert || status === "saved" || status === "restored";

  return (
    <>
      <form onSubmit={submit} noValidate>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,640px)_420px] xl:items-start xl:gap-6">
          <div className="space-y-3">
            <SettingsPanel title="Você" description="Aparecem na mensagem como {remetente} e {minha_empresa}.">
              <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-3">
                <TextField
                  id="s-company"
                  label="Nome da empresa"
                  value={draft.companyName}
                  error={errors.companyName}
                  onChange={(companyName) => change((d) => ({ ...d, companyName }))}
                />
                <TextField
                  id="s-sender"
                  label="Quem envia"
                  value={draft.senderName}
                  error={errors.senderName}
                  onChange={(senderName) => change((d) => ({ ...d, senderName }))}
                />
                <TextField
                  id="s-days"
                  label="Prazo de entrega (dias)"
                  inputMode="numeric"
                  value={draft.deliveryDays}
                  error={errors.deliveryDays}
                  onChange={(deliveryDays) => change((d) => ({ ...d, deliveryDays }))}
                />
              </div>
            </SettingsPanel>

            <SettingsPanel title="Planos" description="De 1 a 5 planos. O valor digitado é o preço final cobrado do cliente.">
              <ul className="divide-y divide-line-soft">
                {draft.plans.map((plan, index) => (
                  <li key={index} className="space-y-4 py-4 first:pt-0 last:pb-0">
                    <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-start">
                      <TextField
                        id={`s-plan-name-${index}`}
                        label="Nome do plano"
                        value={plan.name}
                        error={errors[`plans.${index}.name`]}
                        onChange={(name) => updatePlan(index, { name })}
                      />
                      <TextField
                        id={`s-plan-price-${index}`}
                        label="Valor (R$)"
                        inputMode="decimal"
                        value={plan.price}
                        error={errors[`plans.${index}.price`]}
                        onChange={(price) => updatePlan(index, { price })}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="justify-self-start sm:mt-6"
                        disabled={draft.plans.length <= 1}
                        aria-label={`Remover o plano ${plan.name || index + 1}`}
                        icon={<TrashIcon />}
                        onClick={() => change((d) => ({ ...d, plans: d.plans.filter((_, i) => i !== index) }))}
                      >
                        Remover
                      </Button>
                    </div>
                    <TextField
                      id={`s-plan-desc-${index}`}
                      label="O que está incluído"
                      rows={2}
                      value={plan.description}
                      error={errors[`plans.${index}.description`]}
                      onChange={(description) => updatePlan(index, { description })}
                    />
                  </li>
                ))}
              </ul>
              {errors.plans && (
                <p role="alert" className="text-legenda text-danger">
                  {errors.plans}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  icon={<PlusIcon />}
                  disabled={draft.plans.length >= 5}
                  onClick={() =>
                    change((d) => ({ ...d, plans: [...d.plans, { name: "", price: "", description: "" }] }))
                  }
                >
                  Adicionar plano
                </Button>
                {draft.plans.length >= 5 && <p className="text-legenda text-subtle">Limite de 5 planos.</p>}
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Hospedagem e domínio"
              description="Custo de referência, pago à parte pelo cliente ou embutido no valor dos planos."
            >
              <Checkbox
                checked={draft.includeHostingAndDomain}
                onChange={(event) => change((d) => ({ ...d, includeHostingAndDomain: event.target.checked }))}
              >
                Incluir o primeiro ano de hospedagem e domínio no valor dos planos
              </Checkbox>
              <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-3">
                <TextField
                  id="s-host-provider"
                  label="Hospedagem"
                  value={draft.hosting.provider}
                  error={errors["hosting.provider"]}
                  onChange={(provider) => change((d) => ({ ...d, hosting: { ...d.hosting, provider } }))}
                />
                <TextField
                  id="s-host-monthly"
                  label="Mensalidade (R$)"
                  inputMode="decimal"
                  value={draft.hosting.monthlyPrice}
                  error={errors["hosting.monthlyPrice"]}
                  onChange={(monthlyPrice) => change((d) => ({ ...d, hosting: { ...d.hosting, monthlyPrice } }))}
                />
                <TextField
                  id="s-host-renewal"
                  label="Mensalidade na renovação (R$)"
                  inputMode="decimal"
                  value={draft.hosting.renewalMonthlyPrice}
                  error={errors["hosting.renewalMonthlyPrice"]}
                  onChange={(renewalMonthlyPrice) =>
                    change((d) => ({ ...d, hosting: { ...d.hosting, renewalMonthlyPrice } }))
                  }
                />
                <TextField
                  id="s-host-url"
                  label="Link de contratação"
                  inputMode="url"
                  value={draft.hosting.url}
                  error={errors["hosting.url"]}
                  className="sm:col-span-3"
                  onChange={(url) => change((d) => ({ ...d, hosting: { ...d.hosting, url } }))}
                />
                <TextField
                  id="s-domain-label"
                  label="Domínio"
                  value={draft.domain.label}
                  error={errors["domain.label"]}
                  className="sm:col-span-2"
                  onChange={(label) => change((d) => ({ ...d, domain: { ...d.domain, label } }))}
                />
                <TextField
                  id="s-domain-price"
                  label="Anuidade do domínio (R$)"
                  inputMode="decimal"
                  value={draft.domain.yearlyPrice}
                  error={errors["domain.yearlyPrice"]}
                  onChange={(yearlyPrice) => change((d) => ({ ...d, domain: { ...d.domain, yearlyPrice } }))}
                />
              </div>
              <CostSummary draft={draft} />
            </SettingsPanel>

            <SettingsPanel title="Modelo da mensagem" description="A situação do site muda a frase de abertura automaticamente.">
              <Field id="s-template" label="Texto" error={errors.template}>
                {(control) => (
                  <textarea
                    {...control}
                    value={draft.template}
                    rows={12}
                    onChange={(event) => change((d) => ({ ...d, template: event.target.value }))}
                    className={textareaClass}
                  />
                )}
              </Field>
              <details className="group">
                <summary className="-ml-2 inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-control px-2 text-botao font-semibold text-muted transicao select-none hover:bg-hover hover:text-fg [&::-webkit-details-marker]:hidden">
                  Marcadores disponíveis
                  <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[10rem_1fr]">
                  {OUTREACH_PLACEHOLDERS.map(({ key, help }) => (
                    <div key={key} className="contents">
                      <dt>
                        <code className="rounded-badge bg-hover px-1.5 py-px font-mono text-legenda text-fg shadow-[inset_0_0_0_1px_var(--fio)]">{`{${key}}`}</code>
                      </dt>
                      <dd className="text-muted">{help}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-legenda text-subtle">Marcadores que não existem ficam no texto do jeito que estão.</p>
              </details>
            </SettingsPanel>
          </div>

          {/* Prévia fixa (≥ 1280 px); abaixo disso ela abre numa folha pelo botão "Prévia" da barra. */}
          <aside
            aria-labelledby="previa-titulo"
            className={cx(
              panelClass,
              "hidden flex-col gap-4 p-5 xl:sticky xl:top-6 xl:flex xl:max-h-[calc(100dvh-112px)]",
            )}
          >
            <div>
              <h2 id="previa-titulo" className="rotulo">
                Prévia
              </h2>
              <p className="mt-1 text-legenda text-subtle">{PREVIEW_HINT}</p>
            </div>
            <PreviewBody idPrefix="s-preview" status={previewStatus} onStatus={setPreviewStatus} message={preview} />
          </aside>
        </div>

        {/* Barra de ações: fica no pé da tela enquanto se edita (acima das abas no celular). */}
        <div className="sticky bottom-14 z-20 -mx-4 mt-6 border-t border-line bg-canvas px-4 py-3 sm:-mx-6 sm:px-6 md:bottom-0 xl:flex xl:items-center xl:gap-3">
          <div className={cx("min-w-0 xl:order-last xl:ml-auto", hasNote && "mb-2 xl:mb-0")}>
            <p role="status" className="flex items-center gap-1.5 text-muted">
              {status === "saved" && (
                <>
                  <CheckIcon className="size-4 shrink-0" />
                  Configurações salvas.
                </>
              )}
              {status === "restored" && "Padrão carregado. Clique em Salvar para aplicar."}
            </p>
            {hasAlert && (
              <p role="alert" className="flex items-start gap-1.5 text-danger">
                <AlertIcon className="mt-0.5 size-4 shrink-0" />
                {failure ?? "Corrija os campos marcados antes de salvar."}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button className="xl:hidden" onClick={() => setSheetOpen(true)}>
              Prévia
            </Button>
            <Button type="submit" variant="primary" loading={status === "saving"}>
              {status === "saving" ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" disabled={status === "saving"} onClick={restore}>
              Restaurar padrão
            </Button>
          </div>
        </div>
      </form>

      {sheetOpen && (
        <Sheet label="Prévia da mensagem" side="bottom" onClose={() => setSheetOpen(false)}>
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
            <div>
              <h2 className="font-display text-h2 font-semibold">Prévia da mensagem</h2>
              <p className="text-legenda text-subtle">{PREVIEW_HINT}</p>
            </div>
            <IconButton
              label="Fechar"
              className="-mt-1 -mr-2"
              onClick={(event) => event.currentTarget.closest("dialog")?.close()}
            >
              <CloseIcon />
            </IconButton>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <PreviewBody
              idPrefix="s-preview-folha"
              status={previewStatus}
              onStatus={setPreviewStatus}
              message={preview}
            />
          </div>
        </Sheet>
      )}
    </>
  );
}

export function SettingsView() {
  const settings = useApiGet<OutreachSettings>(outreachSettingsPath);
  const { data, error, reload, mutate } = settings;

  if (!data) {
    return error ? (
      <ErrorState message="Não consegui carregar as configurações." detail={error} onRetry={reload} />
    ) : (
      <div className="max-w-[640px] space-y-3" aria-busy="true" role="status" aria-label="Carregando configurações">
        <Skeleton className="h-36 w-full rounded-panel" />
        <Skeleton className="h-72 w-full rounded-panel" />
      </div>
    );
  }
  return <SettingsForm initial={data} onSaved={(saved) => mutate(() => saved)} />;
}
