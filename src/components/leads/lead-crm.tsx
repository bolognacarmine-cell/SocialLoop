"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Tag, X } from "lucide-react";
import { formatDate, humanizeEnum } from "@/lib/utils";

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "NURTURING", "OFFER_SENT", "WON", "LOST"];

export type LeadListItem = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  stage: string;
  source: string;
  score: number;
  createdAt: string;
  campaignName: string | null;
  tags: Array<{ name: string; color: string }>;
  conversions: number;
  emails: number;
  submissions: number;
};

export function LeadCrm({ leads, segments }: { leads: LeadListItem[]; segments: Array<{ id: string; name: string; count: number }> }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("");
  const [selected, setSelected] = useState<LeadListItem | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (stage && lead.stage !== stage) return false;
      if (!term) return true;
      return (
        lead.email.toLowerCase().includes(term) ||
        (lead.name ?? "").toLowerCase().includes(term) ||
        (lead.company ?? "").toLowerCase().includes(term)
      );
    });
  }, [leads, search, stage]);

  async function updateStage(lead: LeadListItem, nextStage: string) {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: nextStage })
    });
    router.refresh();
  }

  async function addTag(lead: LeadListItem, tag: string) {
    if (!tag.trim()) return;
    await fetch(`/api/leads/${lead.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: tag.trim() })
    });
    router.refresh();
  }

  async function removeTag(lead: LeadListItem, tag: string) {
    await fetch(`/api/leads/${lead.id}/tags?tag=${encodeURIComponent(tag)}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card card-pad md:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Cerca per email, nome o azienda…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select className="input sm:w-48" value={stage} onChange={(event) => setStage(event.target.value)}>
              <option value="">Tutte le fasi</option>
              {STAGES.map((value) => (
                <option key={value} value={value}>
                  {humanizeEnum(value)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="card card-pad">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Segmenti</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {segments.length === 0 ? (
              <span className="text-sm text-slate-400">Nessun segmento</span>
            ) : (
              segments.map((segment) => (
                <span key={segment.id} className="badge bg-loop-100 text-loop-700">
                  {segment.name} · {segment.count}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="table-th">Lead</th>
              <th className="table-th">Fase</th>
              <th className="table-th">Score</th>
              <th className="table-th">Tag</th>
              <th className="table-th">Attività</th>
              <th className="table-th">Creato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td className="table-td text-center text-slate-500" colSpan={6}>
                  Nessun lead corrisponde ai filtri.
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <tr
                  key={lead.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelected(lead)}
                >
                  <td className="table-td">
                    <p className="font-medium text-slate-900">{lead.name ?? lead.email}</p>
                    <p className="text-xs text-slate-500">
                      {lead.email}
                      {lead.company ? ` · ${lead.company}` : ""}
                    </p>
                  </td>
                  <td className="table-td" onClick={(event) => event.stopPropagation()}>
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                      value={lead.stage}
                      onChange={(event) => void updateStage(lead, event.target.value)}
                    >
                      {STAGES.map((value) => (
                        <option key={value} value={value}>
                          {humanizeEnum(value)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="table-td">
                    <span className="badge bg-slate-100 text-slate-700">{lead.score}</span>
                  </td>
                  <td className="table-td" onClick={(event) => event.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-1">
                      {lead.tags.map((tag) => (
                        <span
                          key={tag.name}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                          <button
                            type="button"
                            onClick={() => void removeTag(lead, tag.name)}
                            className="opacity-70 hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        className="rounded-full border border-dashed border-slate-300 p-1 text-slate-400 hover:text-loop-600"
                        onClick={() => {
                          const tag = window.prompt("Nuovo tag");
                          if (tag) void addTag(lead, tag);
                        }}
                      >
                        <Tag className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="table-td text-xs text-slate-500">
                    {lead.conversions} conv · {lead.emails} email · {lead.submissions} form
                  </td>
                  <td className="table-td text-xs text-slate-500">{formatDate(lead.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <LeadDrawer lead={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

function LeadDrawer({ lead, onClose }: { lead: LeadListItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{lead.name ?? lead.email}</h2>
            <p className="text-sm text-slate-500">{lead.email}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost !px-2 !py-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info label="Fase" value={humanizeEnum(lead.stage)} />
          <Info label="Score" value={String(lead.score)} />
          <Info label="Fonte" value={humanizeEnum(lead.source)} />
          <Info label="Campagna" value={lead.campaignName ?? "—"} />
          <Info label="Azienda" value={lead.company ?? "—"} />
          <Info label="Creato" value={formatDate(lead.createdAt, true)} />
        </div>

        <div className="mt-5">
          <p className="label">Tag</p>
          <div className="flex flex-wrap gap-1.5">
            {lead.tags.length === 0 ? (
              <span className="text-sm text-slate-400">Nessun tag</span>
            ) : (
              lead.tags.map((tag) => (
                <span
                  key={tag.name}
                  className="rounded-full px-2.5 py-1 text-xs text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 py-3">
            <p className="text-lg font-bold text-slate-900">{lead.conversions}</p>
            <p className="text-xs text-slate-500">Conversioni</p>
          </div>
          <div className="rounded-xl bg-slate-50 py-3">
            <p className="text-lg font-bold text-slate-900">{lead.emails}</p>
            <p className="text-xs text-slate-500">Email</p>
          </div>
          <div className="rounded-xl bg-slate-50 py-3">
            <p className="text-lg font-bold text-slate-900">{lead.submissions}</p>
            <p className="text-xs text-slate-500">Form</p>
          </div>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          ID lead: <span className="font-mono">{lead.id}</span>
        </p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  );
}
