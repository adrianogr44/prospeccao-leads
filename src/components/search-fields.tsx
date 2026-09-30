"use client";

import type { ZodError } from "zod";
import type { MetaResponse } from "@/lib/contract";
import { AlertIcon } from "./icons";
import { Field, inputClass } from "./ui";

export type FieldErrors = Partial<Record<string, string>>;

const MESSAGES: Record<string, string> = {
  category: "Informe a categoria (mínimo de 2 letras).",
  keywords: "Use no máximo 120 caracteres.",
  city: "Informe a cidade (mínimo de 2 letras).",
  state: "Use no máximo 40 caracteres.",
  radiusKm: "O raio deve ficar entre 1 e 100 km.",
  maxLeads: "O limite deve ficar entre 10 e 5.000 empresas.",
  hour: "Escolha uma hora entre 0 e 23.",
  frequency: "Escolha a frequência.",
};

export function fieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errors[key]) errors[key] = MESSAGES[key] ?? "Valor inválido.";
  }
  return errors;
}

/** Lê o formulário como objeto simples; campos opcionais vazios saem. */
export function readForm(form: HTMLFormElement): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === "string" && value.trim() !== "") raw[key] = value.trim();
  }
  return raw;
}

export function GoogleKeyNotice({ config }: { config: MetaResponse["config"] | undefined }) {
  if (!config || config.googlePlaces) return null;
  return (
    <p role="note" className="flex items-start gap-2 rounded-md border border-warn/40 px-3 py-2 text-warn">
      <AlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>
        A chave do Google Places não está configurada. Pesquisas pelo Google não vão funcionar; a fonte
        automática usa só o OpenStreetMap.
      </span>
    </p>
  );
}

export function SearchFields({ errors, prefix }: { errors: FieldErrors; prefix: string }) {
  const id = (name: string) => `${prefix}-${name}`;
  return (
    <>
      <Field id={id("category")} label="Categoria" error={errors.category} hint="Ex.: dentista, restaurante">
        {(c) => <input {...c} name="category" required maxLength={80} className={inputClass} />}
      </Field>
      <Field id={id("keywords")} label="Palavras-chave (opcional)" error={errors.keywords}>
        {(c) => <input {...c} name="keywords" maxLength={120} className={inputClass} />}
      </Field>
      <Field id={id("city")} label="Cidade" error={errors.city}>
        {(c) => <input {...c} name="city" required maxLength={80} className={inputClass} />}
      </Field>
      <Field id={id("state")} label="Estado (UF)" error={errors.state}>
        {(c) => <input {...c} name="state" maxLength={40} className={inputClass} placeholder="SP" />}
      </Field>
      <Field id={id("radiusKm")} label="Raio (km)" error={errors.radiusKm}>
        {(c) => (
          <input
            {...c}
            name="radiusKm"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            defaultValue={10}
            className={inputClass}
          />
        )}
      </Field>
      <Field id={id("provider")} label="Fonte" error={errors.provider}>
        {(c) => (
          <select {...c} name="provider" defaultValue="auto" className={inputClass}>
            <option value="auto">Automática</option>
            <option value="google">Google</option>
            <option value="osm">OpenStreetMap</option>
          </select>
        )}
      </Field>
      <Field id={id("maxLeads")} label="Limite de empresas" error={errors.maxLeads}>
        {(c) => (
          <input
            {...c}
            name="maxLeads"
            type="number"
            inputMode="numeric"
            min={10}
            max={5000}
            defaultValue={500}
            className={inputClass}
          />
        )}
      </Field>
    </>
  );
}
