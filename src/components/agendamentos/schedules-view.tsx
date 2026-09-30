"use client";

import { useState, type FormEvent } from "react";
import { createSchedule, deleteSchedule, errorMessage, metaPath, schedulesPath, setScheduleActive } from "@/lib/api";
import {
  FREQUENCIES,
  scheduleInputSchema,
  type Frequency,
  type MetaResponse,
  type ScheduleDTO,
} from "@/lib/contract";
import { cx } from "@/lib/cx";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useApiGet } from "@/lib/use-api";
import { AlertIcon, PlusIcon, TrashIcon } from "../icons";
import { fieldErrors, GoogleKeyNotice, readForm, SearchFields, type FieldErrors } from "../search-fields";
import { Button, EmptyState, ErrorState, Field, inputClass, Section, Skeleton } from "../ui";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Todo dia",
  weekly: "Toda semana",
  monthly: "Todo mês",
};

const PROVIDER_LABEL = { auto: "Automática", google: "Google", osm: "OpenStreetMap" } as const;

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

function NewScheduleForm({ meta, onCreated }: { meta: MetaResponse | undefined; onCreated: () => void }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = scheduleInputSchema.safeParse({ ...readForm(form), active: true });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setFailure(null);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await createSchedule(parsed.data);
      form.reset();
      onCreated();
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-lg border border-line bg-surface p-3">
      <GoogleKeyNotice config={meta?.config} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchFields errors={errors} prefix="schedule" />
        <Field id="schedule-frequency" label="Frequência" error={errors.frequency}>
          {(c) => (
            <select {...c} name="frequency" defaultValue="weekly" className={inputClass}>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABEL[f]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="schedule-hour" label="Hora (0 a 23)" error={errors.hour}>
          {(c) => (
            <input
              {...c}
              name="hour"
              type="number"
              inputMode="numeric"
              min={0}
              max={23}
              defaultValue={3}
              className={inputClass}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy}>
          <PlusIcon />
          {busy ? "Salvando…" : "Criar agendamento"}
        </Button>
        {failure && (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        )}
      </div>
    </form>
  );
}

function ScheduleRow({ schedule, onChanged }: { schedule: ScheduleDTO; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const place = [schedule.city, schedule.state].filter(Boolean).join("/");
  const name = `${schedule.category} em ${place}`;
  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <td className="px-3 py-2.5">
        <p className="font-medium">
          {schedule.category} · {place}
        </p>
        <p className="text-xs text-muted">
          {schedule.keywords ? `“${schedule.keywords}” · ` : ""}
          raio de {formatNumber(schedule.radiusKm)} km · {PROVIDER_LABEL[schedule.provider]} · até{" "}
          {formatNumber(schedule.maxLeads)} empresas
        </p>
      </td>
      <td className="px-3 py-2.5">
        {FREQUENCY_LABEL[schedule.frequency]}, às {hourLabel(schedule.hour)}
      </td>
      <td className="px-3 py-2.5 tabular-nums">{schedule.active ? formatDateTime(schedule.nextRunAt) : "—"}</td>
      <td className="px-3 py-2.5 text-muted tabular-nums">{formatDateTime(schedule.lastRunAt)}</td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={schedule.active}
          aria-label={`Agendamento de ${name}`}
          disabled={busy}
          onClick={() => run(() => setScheduleActive(schedule.id, !schedule.active))}
          className="inline-flex items-center gap-2 rounded-full disabled:opacity-50"
        >
          <span
            aria-hidden="true"
            className={cx(
              "relative h-5 w-9 rounded-full border transition-colors",
              schedule.active ? "border-accent bg-accent" : "border-line bg-surface",
            )}
          >
            <span
              className={cx(
                "absolute top-0.5 size-3.5 rounded-full transition-all",
                schedule.active ? "left-[1.1rem] bg-canvas" : "left-0.5 bg-muted",
              )}
            />
          </span>
          <span className="text-xs">{schedule.active ? "Ativo" : "Desativado"}</span>
        </button>
      </td>
      <td className="px-3 py-2.5">
        {confirming ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger-solid"
              size="sm"
              disabled={busy}
              onClick={() => run(() => deleteSchedule(schedule.id))}
            >
              Confirmar
            </Button>
            <Button size="sm" disabled={busy} onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)} aria-label={`Excluir agendamento de ${name}`}>
            <TrashIcon className="size-3.5" />
            Excluir
          </Button>
        )}
        {error && (
          <p role="alert" className="mt-1 max-w-48 text-xs text-danger">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

export function SchedulesView() {
  const meta = useApiGet<MetaResponse>(metaPath);
  const schedules = useApiGet<ScheduleDTO[]>(schedulesPath);
  const items = schedules.data;

  return (
    <>
      <p
        role="note"
        className="mb-5 flex items-start gap-2 rounded-md border border-warn/40 px-3 py-2 text-warn"
      >
        <AlertIcon className="mt-0.5 size-4 shrink-0" />
        <span>Os agendamentos só rodam enquanto o sistema estiver aberto neste computador.</span>
      </p>

      <Section title="Novo agendamento">
        <NewScheduleForm meta={meta.data} onCreated={schedules.reload} />
      </Section>

      <Section title="Agendamentos criados">
        {schedules.error && !items ? (
          <ErrorState message={schedules.error} onRetry={schedules.reload} />
        ) : !items ? (
          <div className="space-y-2" role="status" aria-busy="true" aria-label="Carregando agendamentos">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Nenhum agendamento ainda. Crie um acima para repetir uma pesquisa sozinho." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <caption className="sr-only">Agendamentos de pesquisa</caption>
              <thead>
                <tr className="border-b border-line bg-surface text-left text-xs font-medium text-muted">
                  {["Pesquisa", "Frequência", "Próxima execução", "Última execução", "Situação", "Ações"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((schedule) => (
                  <ScheduleRow key={schedule.id} schedule={schedule} onChanged={schedules.reload} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
