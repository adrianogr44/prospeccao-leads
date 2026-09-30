"use client";

import type { ZodError } from "zod";
import type { MetaResponse } from "@/lib/contract";
import { Field, inputClass, Notice } from "./ui";

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

/** Leva o foco ao primeiro campo (na ordem da tela) que tem erro. */
export function focusFirstError(form: HTMLFormElement, errors: FieldErrors): void {
  for (const element of Array.from(form.elements)) {
    if (
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) &&
      errors[element.name]
    ) {
      element.focus();
      return;
    }
  }
}

export function GoogleKeyNotice({ config }: { config: MetaResponse["config"] | undefined }) {
  if (!config || config.googlePlaces) return null;
  return (
    <Notice>
      A chave do Google Places não está configurada. Pesquisas pelo Google não vão funcionar; a fonte automática
      usa só o OpenStreetMap.
    </Notice>
  );
}

/**
 * Campos de uma pesquisa, na ordem da tela. Devem ficar dentro de uma grade de 6 colunas (`formGridClass`):
 * categoria, fonte e palavras-chave ocupam a linha; cidade e UF, raio e limite dividem linhas.
 */
export function SearchFields({ errors, prefix }: { errors: FieldErrors; prefix: string }) {
  const id = (name: string) => `${prefix}-${name}`;
  return (
    <>
      <Field
        id={id("category")}
        label="Categoria"
        error={errors.category}
        hint="Ex.: dentista, restaurante"
        className="col-span-6"
      >
        {(c) => <input {...c} name="category" required maxLength={80} autoComplete="off" className={inputClass} />}
      </Field>
      <Field id={id("city")} label="Cidade" error={errors.city} className="col-span-4">
        {(c) => <input {...c} name="city" required maxLength={80} autoComplete="off" className={inputClass} />}
      </Field>
      <Field id={id("state")} label="Estado (UF)" error={errors.state} className="col-span-2">
        {(c) => <input {...c} name="state" maxLength={40} autoComplete="off" className={inputClass} placeholder="SP" />}
      </Field>
      <Field id={id("radiusKm")} label="Raio (km)" error={errors.radiusKm} className="col-span-3">
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
      <Field id={id("maxLeads")} label="Limite de empresas" error={errors.maxLeads} className="col-span-3">
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
      <Field id={id("provider")} label="Fonte" error={errors.provider} className="col-span-6">
        {(c) => (
          <select {...c} name="provider" defaultValue="auto" className={inputClass}>
            <option value="auto">Automática</option>
            <option value="google">Google</option>
            <option value="osm">OpenStreetMap</option>
          </select>
        )}
      </Field>
      <Field id={id("keywords")} label="Palavras-chave (opcional)" error={errors.keywords} className="col-span-6">
        {(c) => <input {...c} name="keywords" maxLength={120} autoComplete="off" className={inputClass} />}
      </Field>
    </>
  );
}
