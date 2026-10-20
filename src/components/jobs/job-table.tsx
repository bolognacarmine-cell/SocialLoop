"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { formatDate, humanizeEnum } from "@/lib/utils";

type Job = {
  id: string;
  queue: string;
  name: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
};

const statusTones: Record<string, string> = {
  QUEUED: "bg-slate-100 text-slate-600",
  RUNNING: "bg-loop-100 text-loop-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-rose-100 text-rose-700",
  RETRYING: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-slate-100 text-slate-500"
};

export function JobTable({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function retry(id: string) {
    setBusy(id);
    setError(null);
    const response = await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Retry non riuscito");
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="table-th">Job</th>
            <th className="table-th">Coda</th>
            <th className="table-th">Stato</th>
            <th className="table-th">Tentativi</th>
            <th className="table-th">Creato</th>
            <th className="table-th" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {jobs.length === 0 ? (
            <tr>
              <td className="table-td text-center text-slate-500" colSpan={6}>
                Nessun job registrato.
              </td>
            </tr>
          ) : (
            jobs.map((job) => (
              <tr key={job.id}>
                <td className="table-td">
                  <p className="font-medium text-slate-900">{job.name}</p>
                  {job.error ? (
                    <p className="max-w-md truncate text-xs text-rose-600">{job.error}</p>
                  ) : null}
                </td>
                <td className="table-td text-xs text-slate-500">{job.queue}</td>
                <td className="table-td">
                  <span className={`badge ${statusTones[job.status] ?? statusTones.QUEUED}`}>
                    {humanizeEnum(job.status)}
                  </span>
                </td>
                <td className="table-td text-xs text-slate-500">
                  {job.attempts}/{job.maxAttempts}
                </td>
                <td className="table-td text-xs text-slate-500">{formatDate(job.createdAt, true)}</td>
                <td className="table-td">
                  {["FAILED", "CANCELLED", "RETRYING"].includes(job.status) ? (
                    <button
                      type="button"
                      disabled={busy === job.id}
                      onClick={() => void retry(job.id)}
                      className="btn-ghost !px-2 !py-1 text-xs"
                    >
                      <RotateCw className="h-3.5 w-3.5" /> Riprova
                    </button>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
