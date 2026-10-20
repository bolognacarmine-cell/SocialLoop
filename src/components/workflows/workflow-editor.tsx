"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Zap } from "lucide-react";
import { humanizeEnum } from "@/lib/utils";

type Rule = { field: string; operator: string; value?: string };

type Step = {
  id: string;
  type: "condition" | "action" | "delay";
  condition?: { match: "all" | "any"; rules: Rule[] };
  action?: Record<string, unknown>;
  delay?: { amount: number; unit: "minutes" | "hours" | "days" };
};

type WorkflowData = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  triggerType: string;
  triggerConfig: { match?: "all" | "any"; rules?: Rule[]; tag?: string; stage?: string; minScore?: number };
  steps: Step[];
};

const TRIGGERS = [
  "LEAD_CREATED",
  "FORM_SUBMITTED",
  "LEAD_STAGE_CHANGED",
  "TAG_ADDED",
  "SCORE_THRESHOLD",
  "CONVERSION",
  "SOCIAL_POST_PUBLISHED",
  "MANUAL",
  "SCHEDULE"
];

const ACTION_TYPES = [
  "send_email",
  "add_tag",
  "remove_tag",
  "update_score",
  "set_stage",
  "add_to_segment",
  "add_to_retargeting",
  "create_social_post",
  "send_webhook"
];

const OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "greater_or_equal",
  "less_than",
  "less_or_equal",
  "exists",
  "not_exists"
];

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "NURTURING", "OFFER_SENT", "WON", "LOST"];

export function WorkflowEditor({
  workflow,
  templates,
  segments,
  accounts
}: {
  workflow: WorkflowData;
  templates: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; accountName: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description ?? "");
  const [triggerType, setTriggerType] = useState(workflow.triggerType);
  const [triggerConfig, setTriggerConfig] = useState(workflow.triggerConfig);
  const [steps, setSteps] = useState<Step[]>(workflow.steps);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  function move(id: string, direction: -1 | 1) {
    setSteps((current) => {
      const index = current.findIndex((step) => step.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addStep(type: Step["type"]) {
    setSteps((current) => [
      ...current,
      type === "condition"
        ? {
            id: crypto.randomUUID(),
            type: "condition",
            condition: { match: "all", rules: [{ field: "stage", operator: "equals", value: "NEW" }] }
          }
        : type === "delay"
          ? { id: crypto.randomUUID(), type: "delay", delay: { amount: 1, unit: "days" } }
          : {
              id: crypto.randomUUID(),
              type: "action",
              action: { type: "send_email", templateId: templates[0]?.id }
            }
    ]);
  }

  function updateAction(stepId: string, patch: Record<string, unknown>) {
    const step = steps.find((item) => item.id === stepId);
    updateStep(stepId, { action: { ...(step?.action ?? {}), ...patch } });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setStatus(null);
    const response = await fetch(`/api/workflows/${workflow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        triggerType,
        triggerConfig,
        steps,
        status
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Salvataggio non riuscito");
    } else {
      setStatus("Automazione salvata.");
      router.refresh();
    }
    setBusy(false);
  }

  async function toggleActive() {
    setBusy(true);
    setError(null);
    await save();
    const response = await fetch(`/api/workflows/${workflow.id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: workflow.status !== "ACTIVE" })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Operazione non riuscita");
    } else {
      setStatus(workflow.status !== "ACTIVE" ? "Automazione attivata." : "Automazione in pausa.");
      router.refresh();
    }
    setBusy(false);
  }

  async function run() {
    setBusy(true);
    setError(null);
    const leadId = window.prompt("ID lead su cui eseguire il test (opzionale)");
    const response = await fetch(`/api/workflows/${workflow.id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: leadId || undefined })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Esecuzione non riuscita");
    } else {
      setStatus("Esecuzione avviata: controlla il job log.");
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card card-pad space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="label">Trigger</label>
            <select
              className="input"
              value={triggerType}
              onChange={(event) => setTriggerType(event.target.value)}
            >
              {TRIGGERS.map((value) => (
                <option key={value} value={value}>
                  {humanizeEnum(value)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Descrizione</label>
          <input
            className="input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        {triggerType === "TAG_ADDED" ? (
          <div>
            <label className="label">Tag trigger</label>
            <input
              className="input"
              value={triggerConfig.tag ?? ""}
              onChange={(event) => setTriggerConfig({ ...triggerConfig, tag: event.target.value })}
            />
          </div>
        ) : null}
        {triggerType === "LEAD_STAGE_CHANGED" ? (
          <div>
            <label className="label">Fase trigger</label>
            <select
              className="input"
              value={triggerConfig.stage ?? ""}
              onChange={(event) => setTriggerConfig({ ...triggerConfig, stage: event.target.value })}
            >
              <option value="">Qualsiasi</option>
              {STAGES.map((value) => (
                <option key={value} value={value}>
                  {humanizeEnum(value)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {triggerType === "SCORE_THRESHOLD" ? (
          <div>
            <label className="label">Score minimo</label>
            <input
              type="number"
              className="input"
              value={triggerConfig.minScore ?? 0}
              onChange={(event) => setTriggerConfig({ ...triggerConfig, minScore: Number(event.target.value) })}
            />
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Passi dell'automazione</h2>
            <p className="text-sm text-slate-500">Condizioni, azioni e attese eseguite in sequenza.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => addStep("condition")}>
              + Condizione
            </button>
            <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => addStep("delay")}>
              + Attesa
            </button>
            <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => addStep("action")}>
              + Azione
            </button>
          </div>
        </div>

        <div className="space-y-3 p-5">
          {steps.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Nessun passo. Aggiungine uno sopra.</p>
          ) : (
            steps.map((step, index) => (
              <div key={step.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="badge bg-loop-100 text-loop-700">
                    #{index + 1} · {step.type === "condition" ? "Condizione" : step.type === "delay" ? "Attesa" : "Azione"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(step.id, -1)}
                      disabled={index === 0}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-40"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(step.id, 1)}
                      disabled={index === steps.length - 1}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-40"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))}
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {step.type === "condition" && step.condition ? (
                  <div className="space-y-2">
                    <select
                      className="input"
                      value={step.condition.match}
                      onChange={(event) =>
                        updateStep(step.id, {
                          condition: { ...step.condition!, match: event.target.value as "all" | "any" }
                        })
                      }
                    >
                      <option value="all">Tutte le regole</option>
                      <option value="any">Almeno una regola</option>
                    </select>
                    {step.condition.rules.map((rule, ruleIndex) => (
                      <div key={ruleIndex} className="grid gap-2 sm:grid-cols-3">
                        <input
                          className="input"
                          placeholder="Campo (es. score, stage, tag)"
                          value={rule.field}
                          onChange={(event) => {
                            const rules = [...step.condition!.rules];
                            rules[ruleIndex] = { ...rule, field: event.target.value };
                            updateStep(step.id, { condition: { ...step.condition!, rules } });
                          }}
                        />
                        <select
                          className="input"
                          value={rule.operator}
                          onChange={(event) => {
                            const rules = [...step.condition!.rules];
                            rules[ruleIndex] = { ...rule, operator: event.target.value };
                            updateStep(step.id, { condition: { ...step.condition!, rules } });
                          }}
                        >
                          {OPERATORS.map((operator) => (
                            <option key={operator} value={operator}>
                              {humanizeEnum(operator)}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input"
                          placeholder="Valore"
                          value={rule.value ?? ""}
                          onChange={(event) => {
                            const rules = [...step.condition!.rules];
                            rules[ruleIndex] = { ...rule, value: event.target.value };
                            updateStep(step.id, { condition: { ...step.condition!, rules } });
                          }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-ghost !px-2 !py-1 text-xs"
                      onClick={() =>
                        updateStep(step.id, {
                          condition: {
                            ...step.condition!,
                            rules: [...step.condition!.rules, { field: "", operator: "equals", value: "" }]
                          }
                        })
                      }
                    >
                      + Regola
                    </button>
                  </div>
                ) : null}

                {step.type === "delay" && step.delay ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="number"
                      className="input"
                      value={step.delay.amount}
                      onChange={(event) =>
                        updateStep(step.id, { delay: { ...step.delay!, amount: Number(event.target.value) } })
                      }
                    />
                    <select
                      className="input"
                      value={step.delay.unit}
                      onChange={(event) =>
                        updateStep(step.id, {
                          delay: { ...step.delay!, unit: event.target.value as "minutes" | "hours" | "days" }
                        })
                      }
                    >
                      <option value="minutes">Minuti</option>
                      <option value="hours">Ore</option>
                      <option value="days">Giorni</option>
                    </select>
                  </div>
                ) : null}

                {step.type === "action" ? (
                  <div className="space-y-2">
                    <select
                      className="input"
                      value={String(step.action?.type ?? "send_email")}
                      onChange={(event) => updateAction(step.id, { type: event.target.value })}
                    >
                      {ACTION_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {humanizeEnum(value)}
                        </option>
                      ))}
                    </select>

                    {step.action?.type === "send_email" ? (
                      <select
                        className="input"
                        value={String(step.action.templateId ?? "")}
                        onChange={(event) => updateAction(step.id, { templateId: event.target.value })}
                      >
                        <option value="">Seleziona template…</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {["add_tag", "remove_tag"].includes(String(step.action?.type)) ? (
                      <input
                        className="input"
                        placeholder="Nome tag"
                        value={String(step.action?.tagName ?? "")}
                        onChange={(event) => updateAction(step.id, { tagName: event.target.value })}
                      />
                    ) : null}
                    {step.action?.type === "update_score" ? (
                      <input
                        type="number"
                        className="input"
                        placeholder="Punti (+/-)"
                        value={Number(step.action.amount ?? 0)}
                        onChange={(event) => updateAction(step.id, { amount: Number(event.target.value) })}
                      />
                    ) : null}
                    {step.action?.type === "set_stage" ? (
                      <select
                        className="input"
                        value={String(step.action.stage ?? "")}
                        onChange={(event) => updateAction(step.id, { stage: event.target.value })}
                      >
                        <option value="">Seleziona fase…</option>
                        {STAGES.map((value) => (
                          <option key={value} value={value}>
                            {humanizeEnum(value)}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {step.action?.type === "add_to_segment" ? (
                      <select
                        className="input"
                        value={String(step.action.segmentId ?? "")}
                        onChange={(event) => updateAction(step.id, { segmentId: event.target.value })}
                      >
                        <option value="">Seleziona segmento…</option>
                        {segments.map((segment) => (
                          <option key={segment.id} value={segment.id}>
                            {segment.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {step.action?.type === "add_to_retargeting" ? (
                      <input
                        className="input"
                        placeholder="Nome audience"
                        value={String(step.action.audienceName ?? "")}
                        onChange={(event) => updateAction(step.id, { audienceName: event.target.value })}
                      />
                    ) : null}
                    {step.action?.type === "create_social_post" ? (
                      <textarea
                        className="textarea"
                        placeholder="Testo del post"
                        value={String(step.action.body ?? "")}
                        onChange={(event) => updateAction(step.id, { body: event.target.value })}
                      />
                    ) : null}
                    {step.action?.type === "send_webhook" ? (
                      <input
                        className="input"
                        placeholder="https://…"
                        value={String(step.action.url ?? "")}
                        onChange={(event) => updateAction(step.id, { url: event.target.value })}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={busy} className="btn-primary">
              <Save className="h-4 w-4" /> Salva
            </button>
            <button type="button" onClick={() => void toggleActive()} disabled={busy} className="btn-secondary">
              <Zap className="h-4 w-4" /> {workflow.status === "ACTIVE" ? "Metti in pausa" : "Attiva"}
            </button>
            <button type="button" onClick={() => void run()} disabled={busy} className="btn-ghost">
              Esegui test
            </button>
          </div>
          <span
            className={`badge ${
              workflow.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {humanizeEnum(workflow.status)}
          </span>
        </div>
        {error ? (
          <p className="mx-5 mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        {status ? (
          <p className="mx-5 mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p>
        ) : null}
      </div>
    </div>
  );
}
