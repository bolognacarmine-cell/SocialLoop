"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, RefreshCw, Trash2 } from "lucide-react";
import { PLATFORM_META } from "@/lib/social/platforms";
import type { SocialPlatform } from "@prisma/client";
import { formatDate, humanizeEnum } from "@/lib/utils";

type Account = {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  status: string;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
};

export function ChannelsManager({
  accounts,
  platforms,
  mockEnabled
}: {
  accounts: Account[];
  platforms: SocialPlatform[];
  mockEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function disconnect(id: string) {
    if (!confirm("Scollegare questo canale?")) return;
    setBusy(id);
    setError(null);
    const response = await fetch(`/api/social/accounts/${id}`, { method: "DELETE" });
    if (!response.ok) setError("Scollegamento non riuscito");
    setBusy(null);
    router.refresh();
  }

  async function refresh(id: string) {
    setBusy(id);
    setError(null);
    const response = await fetch(`/api/social/accounts/${id}/refresh`, { method: "POST" });
    if (!response.ok) setError("Refresh del token non riuscito");
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="card">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Canali collegati</h2>
          <p className="text-sm text-slate-500">
            {accounts.length} canali ·{" "}
            {mockEnabled ? "modalità mock attiva (nessuna credenziale reale)" : "modalità live"}
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {accounts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Nessun canale collegato. Collega il primo social qui sotto.
            </p>
          ) : (
            accounts.map((account) => {
              const meta = PLATFORM_META[account.platform];
              return (
                <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {meta.short}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{account.accountName}</p>
                      <p className="text-xs text-slate-500">
                        {meta.label} · {humanizeEnum(account.status)}
                        {account.lastSyncedAt ? ` · sync ${formatDate(account.lastSyncedAt)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === account.id}
                      onClick={() => void refresh(account.id)}
                      className="btn-ghost !px-3 !py-1.5 text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh token
                    </button>
                    <button
                      type="button"
                      disabled={busy === account.id}
                      onClick={() => void disconnect(account.id)}
                      className="btn-danger !px-3 !py-1.5 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Scollega
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="text-base font-semibold text-slate-900">Collega un nuovo canale</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          In modalità mock il flusso OAuth viene simulato internamente.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {platforms.map((platform) => {
            const meta = PLATFORM_META[platform];
            return (
              <a
                key={platform}
                href={`/api/social/connect/${platform.toLowerCase()}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-loop-300 hover:bg-loop-50"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.short}
                </span>
                {meta.label}
                <Link2 className="ml-auto h-4 w-4 text-slate-400" />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
