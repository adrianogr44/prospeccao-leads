"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
import {
  fieldErrors,
  focusFirstError,
  GoogleKeyNotice,
  readForm,
  SearchFields,
  type FieldErrors,
} from "../search-fields";
import {
  Button,
  cardStyles,
  EmptyState,
  ErrorState,
  Field,
  formGridClass,
  inputClass,
  Notice,
  panelClass,
  Section,
  Skeleton,
  Switch,
} from "../ui";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Todo dia",
  weekly: "Toda semana",
  monthly: "Todo mês",
};

const PROVIDER_LABEL = { auto: "Automática", google: "Google", osm: "OpenStreetMap" } as const;

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const placeOf = (s: Pick<ScheduleDTO, "city" | "state">) => [s.city, s.state].filter(Boolean).join("/");

function NewScheduleForm({
  meta,
  onCreated,
}: {
  meta: MetaResponse | undefined;
  onCreated: (schedule: ScheduleDTO) => void;
}) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const parsed = scheduleInputSchema.safeParse({ ...readForm(form), active: true });
    if (!parsed.success) {
      const next = fieldErrors(parsed.error);
      setErrors(next);
      setFailure(null);
      focusFirstError(form, next);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      const created = await createSchedule(parsed.data);
      form.reset();
      onCreated(created);
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <GoogleKeyNotice config={meta?.config} />
      <div className={formGridClass}>
        <SearchFields errors={errors} prefix="schedule" />
        <Field id="schedule-frequency" label="Frequência" error={errors.frequency} className="col-span-4">
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
        <Field id="schedule-hour" label="Hora (0 a 23)" error={errors.hour} className="col-span-2">
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
      <Button type="submit" variant="primary" loading={busy} icon={<PlusIcon />} className="w-full">
        {busy ? "Salvando…" : "Criar agendamento"}
      </Button>
      {failure && (
        <p role="alert" className="flex items-start gap-1 text-legenda text-danger">
          <AlertIcon className="mt-px size-3.5 shrink-0" />
          {failure}
        </p>
      )}
    </form>
  );
}

function ScheduleCard({
  schedule,
  takeFocus,
  onChanged,
  onDeleted,
}: {
  schedule: ScheduleDTO;
  takeFocus: boolean;
  onChanged: (announcement: string) => void;
  onDeleted: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cartão recém-criado: o foco vai para ele assim que entra na lista.
  useEffect(() => {
    if (takeFocus) ref.current?.focus();
  }, [takeFocus]);

  const place = placeOf(schedule);
  const name = `${schedule.category} em ${place}`;
  const titleId = `agendamento-${schedule.id}`;

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setScheduleActive(schedule.id, next);
      onChanged(`Agendamento de ${name} ${next ? "ativado" : "desativado"}.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteSchedule(schedule.id);
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
      setConfirming(false);
    }
  }

  function cancel() {
    setConfirming(false);
    // O botão "Excluir" volta ao DOM no próximo quadro; o foco volta para ele.
    requestAnimationFrame(() => deleteRef.current?.focus());
  }

  return (
    <article ref={ref} tabIndex={-1} aria-labelledby={titleId} className={cx(cardStyles(), "p-4 focus-visible:outline-offset-4")}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="truncate text-forte font-semibold">
            {schedule.category} · {place}
          </h3>
          <p className="mt-0.5 text-legenda text-subtle">
            {schedule.keywords ? `“${schedule.keywords}” · ` : ""}
            raio de {formatNumber(schedule.radiusKm)} km · {PROVIDER_LABEL[schedule.provider]} · até{" "}
            {formatNumber(schedule.maxLeads)} empresas
          </p>
        </div>
        <Switch
          checked={schedule.active}
          label={`Agendamento de ${name}`}
          disabled={busy}
          className="-my-1 -mr-1 pr-1"
          onCheckedChange={toggle}
        >
          {schedule.active ? "Ativo" : "Desativado"}
        </Switch>
      </header>

      <p
        className={cx(
          "mt-3 font-display text-h2 font-semibold",
          schedule.active ? "text-fg" : "text-subtle",
        )}
      >
        {schedule.active ? `Próxima: ${formatDateTime(schedule.nextRunAt)}` : "Desativado"}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-legenda text-subtle">
          {FREQUENCY_LABEL[schedule.frequency]}, às {hourLabel(schedule.hour)} · Última:{" "}
          {schedule.lastRunAt ? formatDateTime(schedule.lastRunAt) : "ainda não rodou"}
        </p>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-legenda text-muted">Excluir este agendamento?</span>
            <Button variant="danger-solid" size="sm" loading={busy} autoFocus onClick={remove}>
              Confirmar
            </Button>
            <Button size="sm" disabled={busy} onClick={cancel}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            ref={deleteRef}
            variant="danger"
            size="sm"
            icon={<TrashIcon />}
            aria-label={`Excluir agendamento de ${name}`}
            onClick={() => setConfirming(true)}
          >
            Excluir
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1 text-legenda text-danger">
          <AlertIcon className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </article>
  );
}

export function SchedulesView() {
  const meta = useApiGet<MetaResponse>(metaPath);
  const schedules = useApiGet<ScheduleDTO[]>(schedulesPath);
  const items = schedules.data;

  // Abaixo de 1024 px o formulário fica fechado até "Novo agendamento"; no desktop está sempre à direita.
  const [formOpen, setFormOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (formOpen) formRef.current?.querySelector<HTMLElement>("input, select")?.focus();
  }, [formOpen]);

  const announce = (text: string) => {
    if (liveRef.current) liveRef.current.textContent = text;
  };

  function handleCreated(created: ScheduleDTO) {
    setFocusId(created.id);
    setFormOpen(false);
    schedules.reload();
    announce(`Agendamento criado: ${created.category} em ${placeOf(created)}.`);
  }

  function handleDeleted() {
    schedules.reload();
    announce("Agendamento excluído.");
    headingRef.current?.focus();
  }

  const openForm = () => setFormOpen(true);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <p ref={liveRef} aria-live="polite" className="sr-only" />

      <Section
        title="Agendamentos"
        headingRef={headingRef}
        actions={
          <Button
            size="sm"
            icon={<PlusIcon />}
            className="lg:hidden"
            aria-expanded={formOpen}
            aria-controls="novo-agendamento"
            onClick={() => (formOpen ? setFormOpen(false) : openForm())}
          >
            Novo agendamento
          </Button>
        }
      >
        <div className="space-y-3">
          <Notice>Os agendamentos só rodam enquanto o sistema estiver aberto neste computador.</Notice>

          {schedules.error && !items ? (
            <ErrorState
              message="Não consegui carregar os agendamentos."
              detail={schedules.error}
              onRetry={schedules.reload}
            />
          ) : !items ? (
            <div className="space-y-3" role="status" aria-busy="true" aria-label="Carregando agendamentos">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-card" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Nenhum agendamento ainda."
              description="Crie um para repetir uma pesquisa sozinho, todo dia, semana ou mês."
            >
              <Button variant="primary" icon={<PlusIcon />} className="lg:hidden" onClick={openForm}>
                Novo agendamento
              </Button>
            </EmptyState>
          ) : (
            <>
              {schedules.error && (
                <ErrorState
                  message="Não consegui carregar os agendamentos."
                  detail={schedules.error}
                  onRetry={schedules.reload}
                />
              )}
              <ul className="space-y-3">
                {items.map((schedule) => (
                  <li key={schedule.id}>
                    <ScheduleCard
                      schedule={schedule}
                      takeFocus={focusId === schedule.id}
                      onChanged={(text) => {
                        schedules.reload();
                        announce(text);
                      }}
                      onDeleted={handleDeleted}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Section>

      <Section title="Novo agendamento" className={cx(!formOpen && "max-lg:hidden")}>
        <div ref={formRef} id="novo-agendamento" className={cx(panelClass, "w-full max-w-lg p-5 lg:max-w-none")}>
          <NewScheduleForm meta={meta.data} onCreated={handleCreated} />
        </div>
      </Section>
    </div>
  );
}
