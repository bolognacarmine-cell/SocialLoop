"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function CreateLandingPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/landing-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        headline: headline || undefined,
        published: false,
        blocks: [
          {
            id: crypto.randomUUID(),
            type: "hero",
            title: headline || name,
            text: "Descrivi l'offerta in una frase.",
            ctaLabel: "Scopri di più",
            ctaUrl: "#lead-form",
            align: "center"
          },
          {
            id: crypto.randomUUID(),
            type: "form",
            title: "Ricevi subito l'offerta",
            text: "Lascia la tua email e ti inviamo tutto.",
            align: "center"
          }
        ],
        form: {
          name: `${name} lead form`,
          fields: [
            { name: "email", label: "Email", type: "email", required: true },
            { name: "name", label: "Nome", type: "text", required: false }
          ],
          submitLabel: "Voglio l'offerta",
          successMessage: "Grazie! Controlla la tua inbox."
        }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Creazione non riuscita");
      setLoading(false);
      return;
    }
    router.push(`/dashboard/landing-pages/${data.page.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nuova landing page
      </button>
    );
  }

  return (
    <div className="card card-pad w-full sm:w-96">
      <h3 className="text-sm font-semibold text-slate-900">Nuova landing page</h3>
      <div className="mt-3 space-y-3">
        <input
          className="input"
          placeholder="Nome interno"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className="input"
          placeholder="Headline"
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
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
