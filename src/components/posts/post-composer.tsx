"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { PLATFORM_META } from "@/lib/social/platforms";
import type { SocialPlatform } from "@prisma/client";

type Account = {
  id: string;
  platform: SocialPlatform;
  accountName: string;
};

export function PostComposer({
  accounts,
  campaigns
}: {
  accounts: Account[];
  campaigns: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string[]>(accounts[0] ? [accounts[0].id] : []);
  const [campaignId, setCampaignId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function submit(mode: "draft" | "schedule" | "now") {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const status = mode === "schedule" ? "SCHEDULED" : mode === "now" ? "PUBLISHING" : "DRAFT";
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        status,
        campaignId: campaignId || null,
        linkUrl: linkUrl || null,
        socialAccountIds: selected,
        scheduledAt: mode === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : null
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Errore durante il salvataggio");
      setLoading(false);
      return;
    }

    const postId = data.post?.id;
    if (mode === "now" && postId) {
      await fetch(`/api/posts/${postId}/publish`, { method: "POST" });
    }

    setBody("");
    setSuccess(
      mode === "schedule"
        ? "Post programmato. Il worker lo pubblicherà all'orario previsto."
        : mode === "now"
          ? "Pubblicazione avviata: controlla il job log."
          : "Bozza salvata."
    );
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card card-pad">
      <h2 className="text-base font-semibold text-slate-900">Nuovo contenuto</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Scrivi una volta, pubblica su tutti i canali collegati (adapter modulari).
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="label" htmlFor="post-body">
            Contenuto
          </label>
          <textarea
            id="post-body"
            className="textarea"
            value={body}
            maxLength={10000}
            placeholder="Anteprima del funnel: scopri come trasformare i follower in clienti…"
            onChange={(event) => setBody(event.target.value)}
          />
          <p className="mt-1 text-right text-xs text-slate-400">{body.length}/10000</p>
        </div>

        <div>
          <span className="label">Canali</span>
          {accounts.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Nessun canale connesso. Vai in Canali per collegare i social (in modalità mock).
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accounts.map((account) => {
                const meta = PLATFORM_META[account.platform];
                const active = selected.includes(account.id);
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggle(account.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "border-loop-500 bg-loop-50 text-loop-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      {meta.short}
                    </span>
                    {account.accountName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="post-campaign">
              Campagna
            </label>
            <select
              id="post-campaign"
              className="input"
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
            >
              <option value="">Nessuna campagna</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="post-link">
              Link (landing page)
            </label>
            <input
              id="post-link"
              className="input"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://tuodominio.com/l/guida-gratuita"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="post-schedule">
              Programma per
            </label>
            <input
              id="post-schedule"
              type="datetime-local"
              className="input"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}
        {success ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || !body.trim()}
            onClick={() => void submit("schedule")}
            className="btn-primary"
          >
            <Send className="h-4 w-4" /> Programma
          </button>
          <button
            type="button"
            disabled={loading || !body.trim() || selected.length === 0}
            onClick={() => void submit("now")}
            className="btn-secondary"
          >
            Pubblica ora
          </button>
          <button
            type="button"
            disabled={loading || !body.trim()}
            onClick={() => void submit("draft")}
            className="btn-ghost"
          >
            Salva bozza
          </button>
        </div>
      </div>
    </div>
  );
}
