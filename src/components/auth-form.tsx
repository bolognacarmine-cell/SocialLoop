"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Qualcosa è andato storto");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-loop-600 text-lg font-black text-white">
          SL
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          {mode === "login" ? "Bentornato su SocialLoop" : "Crea il tuo workspace"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "login"
            ? "Accedi per gestire social, funnel e automazioni."
            : "Inizia gratis: contenuti, landing page, CRM e workflow."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="card card-pad space-y-4">
        {mode === "register" ? (
          <>
            <div>
              <label className="label" htmlFor="name">
                Nome
              </label>
              <input id="name" name="name" required className="input" placeholder="Mario Rossi" />
            </div>
            <div>
              <label className="label" htmlFor="workspaceName">
                Nome workspace
              </label>
              <input
                id="workspaceName"
                name="workspaceName"
                required
                className="input"
                placeholder="La mia agenzia"
              />
            </div>
          </>
        ) : null}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="input"
            placeholder="you@company.com"
            defaultValue={mode === "login" ? "demo@socialloop.local" : ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            className="input"
            placeholder="••••••••"
            defaultValue={mode === "login" ? "demo1234" : ""}
          />
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Attendi…" : mode === "login" ? "Accedi" : "Crea workspace"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        {mode === "login" ? (
          <>
            Non hai un account?{" "}
            <Link href="/register" className="font-semibold text-loop-700">
              Registrati
            </Link>
          </>
        ) : (
          <>
            Hai già un account?{" "}
            <Link href="/login" className="font-semibold text-loop-700">
              Accedi
            </Link>
          </>
        )}
      </p>
      {mode === "login" ? (
        <p className="mt-2 text-center text-xs text-slate-400">
          Demo: demo@socialloop.local / demo1234
        </p>
      ) : null}
    </div>
  );
}
