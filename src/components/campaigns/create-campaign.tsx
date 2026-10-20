"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function CreateCampaign() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        status: "ACTIVE",
        utmSource: "socialloop",
        utmMedium: "social",
        utmCampaign: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Creazione non riuscita");
      setLoading(false);
      return;
    }
    setName("");
    setDescription("");
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nuova campagna
      </button>
    );
  }

  return (
    <div className="card card-pad w-full sm:w-96">
      <h3 className="text-sm font-semibold text-slate-900">Nuova campagna</h3>
      <div className="mt-3 space-y-3">
        <input
          className="input"
          placeholder="Nome campagna"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <textarea
          className="textarea"
          placeholder="Descrizione (opzionale)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={loading || name.trim().length < 2}
            onClick={() => void submit()}
          >
            Crea
          </button>
          <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
