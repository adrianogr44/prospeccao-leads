"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { errorMessage, outreachSettingsPath, saveOutreachSettings } from "@/lib/api";
import {
  outreachSettingsSchema,
  SITE_STATUSES,
  SITE_STATUS_LABEL,
  type OutreachSettings,
  type SiteStatus,
} from "@/lib/contract";
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
import { PlusIcon, TrashIcon } from "../icons";
import { Button, ErrorState, Field, inputClass, Skeleton } from "../ui";

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

// ---------- Peças ----------

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-muted">{description}</p>}
      </div>
      {children}
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
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  inputMode?: "decimal" | "numeric" | "url";
  className?: string;
}) {
  return (
    <Field id={id} label={label} error={error} hint={hint} className={className}>
      {(control) => (
        <input
          {...control}
          value={value}
          inputMode={inputMode}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
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
    <div className="space-y-1 rounded-md border border-line bg-canvas p-3 text-sm">
      <p>
        Custo do primeiro ano: <strong>{formatPrice(firstYear)}</strong> (12 × {formatPrice(monthly)} +{" "}
        {formatPrice(yearly)})
      </p>
      <p>
        Renovação a partir do segundo ano: <strong>{formatPrice(renewal)}/ano</strong> (12 ×{" "}
        {formatPrice(renewalMonthly)} + {formatPrice(yearly)})
      </p>
      {draft.includeHostingAndDomain &&
        draft.plans.map((plan, index) => {
          const price = parseNum(plan.price);
          if (Number.isNaN(price)) return null;
          const margin = planMargin(price, cost);
          const name = plan.name.trim() || `Plano ${index + 1}`;
          return margin > 0 ? (
            <p key={index}>
              {name}: sobra por venda <strong>{formatPrice(margin)}</strong> ({formatPrice(price)} −{" "}
              {formatPrice(firstYear)} de custo do primeiro ano)
            </p>
          ) : (
            <p key={index} className="text-danger" role="alert">
              {name}: este plano não cobre o custo de hospedagem e domínio ({formatPrice(price)} −{" "}
              {formatPrice(firstYear)} = {formatPrice(margin)}).
            </p>
          );
        })}
    </div>
  );
}

// ---------- Formulário ----------

function SettingsForm({ initial, onSaved }: { initial: OutreachSettings; onSaved: (s: OutreachSettings) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "restored">("idle");
  const [previewStatus, setPreviewStatus] = useState<SiteStatus>("NONE");

  const parsed = useMemo(() => outreachSettingsSchema.safeParse(fromDraft(draft)), [draft]);
  const preview = parsed.success
    ? buildOutreachMessage({ ...SAMPLE, siteStatus: previewStatus }, parsed.data)
    : null;

  function change(update: (d: Draft) => Draft) {
    setDraft(update);
    setStatus("idle");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      setFailure("Corrija os campos marcados antes de salvar.");
      return;
    }
    setErrors({});
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
    setErrors({});
    setFailure(null);
    setStatus("restored");
  }

  const updatePlan = (index: number, patch: Partial<Draft["plans"][number]>) =>
    change((d) => ({ ...d, plans: d.plans.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-4">
      <Card title="Você" description="Aparecem na mensagem como {remetente} e {minha_empresa}.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      </Card>

      <Card title="Planos" description="De 1 a 5 planos. O valor digitado é o preço final cobrado do cliente.">
        <ul className="space-y-3">
          {draft.plans.map((plan, index) => (
            <li key={index} className="space-y-2 rounded-md border border-line bg-canvas p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-start">
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
                  className="sm:mt-6"
                  disabled={draft.plans.length <= 1}
                  aria-label={`Remover o plano ${plan.name || index + 1}`}
                  onClick={() => change((d) => ({ ...d, plans: d.plans.filter((_, i) => i !== index) }))}
                >
                  <TrashIcon />
                  Remover
                </Button>
              </div>
              <TextField
                id={`s-plan-desc-${index}`}
                label="O que está incluído"
                value={plan.description}
                error={errors[`plans.${index}.description`]}
                onChange={(description) => updatePlan(index, { description })}
              />
            </li>
          ))}
        </ul>
        {errors.plans && (
          <p role="alert" className="text-xs text-danger">
            {errors.plans}
          </p>
        )}
        <Button
          size="sm"
          disabled={draft.plans.length >= 5}
          onClick={() => change((d) => ({ ...d, plans: [...d.plans, { name: "", price: "", description: "" }] }))}
        >
          <PlusIcon />
          Adicionar plano
        </Button>
      </Card>

      <Card
        title="Hospedagem e domínio"
        description="Custo de referência, pago à parte pelo cliente ou embutido no valor dos planos."
      >
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={draft.includeHostingAndDomain}
            onChange={(event) => change((d) => ({ ...d, includeHostingAndDomain: event.target.checked }))}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span>Incluir o primeiro ano de hospedagem e domínio no valor dos planos</span>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            className="sm:col-span-2"
            onChange={(url) => change((d) => ({ ...d, hosting: { ...d.hosting, url } }))}
          />
          <TextField
            id="s-domain-label"
            label="Domínio"
            value={draft.domain.label}
            error={errors["domain.label"]}
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
      </Card>

      <Card title="Modelo da mensagem" description="A situação do site muda a frase de abertura automaticamente.">
        <Field id="s-template" label="Texto" error={errors.template}>
          {(control) => (
            <textarea
              {...control}
              value={draft.template}
              rows={12}
              onChange={(event) => change((d) => ({ ...d, template: event.target.value }))}
              className={`${inputClass} h-auto min-h-56 py-2 font-mono text-[13px]`}
            />
          )}
        </Field>
        <details>
          <summary className="cursor-pointer text-muted hover:text-fg">Marcadores disponíveis</summary>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
            {OUTREACH_PLACEHOLDERS.map(({ key, help }) => (
              <div key={key} className="contents">
                <dt>
                  <code>{`{${key}}`}</code>
                </dt>
                <dd className="text-muted">{help}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted">Marcadores que não existem ficam no texto do jeito que estão.</p>
        </details>
      </Card>

      <Card title="Prévia" description="Com uma empresa de exemplo (Padaria Bom Pão, Aracaju).">
        <Field id="s-preview-status" label="Situação do site da empresa de exemplo" className="max-w-xs">
          {(control) => (
            <select
              {...control}
              value={previewStatus}
              onChange={(event) => {
                const next = SITE_STATUSES.find((s) => s === event.target.value);
                if (next) setPreviewStatus(next);
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
        {preview !== null ? (
          <pre className="rounded-md border border-line bg-canvas p-3 font-sans text-sm whitespace-pre-wrap">
            {preview}
          </pre>
        ) : (
          <p className="text-muted">Corrija os campos com problema para ver a prévia.</p>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={status === "saving"}>
          {status === "saving" ? "Salvando…" : "Salvar"}
        </Button>
        <Button onClick={restore} disabled={status === "saving"}>
          Restaurar padrão
        </Button>
        <p role="status" className="text-muted">
          {status === "saved" && <span className="text-accent">Configurações salvas.</span>}
          {status === "restored" && "Padrão carregado. Clique em Salvar para aplicar."}
        </p>
        {failure && (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        )}
      </div>
    </form>
  );
}

export function SettingsView() {
  const settings = useApiGet<OutreachSettings>(outreachSettingsPath);
  const { data, error, reload, mutate } = settings;

  if (!data) {
    return error ? (
      <ErrorState message={error} onRetry={reload} />
    ) : (
      <div className="max-w-3xl space-y-4" aria-busy="true" role="status" aria-label="Carregando configurações">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return <SettingsForm initial={data} onSaved={(saved) => mutate(() => saved)} />;
}
