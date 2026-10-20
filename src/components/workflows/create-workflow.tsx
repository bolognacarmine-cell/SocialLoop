"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function CreateWorkflow() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const name = window.prompt("Nome dell'automazione", "Nuova automazione");
    if (!name) return;
    setLoading(true);
    setError(null);
    const response = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        triggerType: "LEAD_CREATED",
        triggerConfig: { match: "all", rules: [] },
        steps: [
          {
            id: crypto.randomUUID(),
            type: "action",
            action: { type: "send_email" }
          }
        ]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Creazione non riuscita");
      setLoading(false);
      return;
    }
    router.push(`/dashboard/workflows/${data.workflow.id}`);
    router.refresh();
  }

  return (
    <div>
      <button type="button" className="btn-primary" disabled={loading} onClick={() => void create()}>
        <Plus className="h-4 w-4" /> Nuova automazione
      </button>
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
