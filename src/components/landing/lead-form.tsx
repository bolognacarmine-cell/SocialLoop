"use client";

import { useEffect, useState } from "react";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export function LeadForm({
  formId,
  fields,
  submitLabel,
  successMessage,
  redirectUrl
}: {
  formId: string;
  fields: Field[];
  submitLabel: string;
  successMessage: string;
  redirectUrl?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payload = {
      landingPageId: null,
      utm: {
        source: params.get("utm_source"),
        medium: params.get("utm_medium"),
        campaign: params.get("utm_campaign"),
        content: params.get("utm_content"),
        term: params.get("utm_term")
      }
    };
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "PAGE_VIEW", ...payload }),
      keepalive: true
    }).catch(() => undefined);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);

    const values: Record<string, string> = {};
    for (const field of fields) {
      if (field.type === "checkbox") {
        values[field.name] = formData.get(field.name) ? "true" : "false";
      } else {
        values[field.name] = String(formData.get(field.name) ?? "");
      }
    }

    const response = await fetch(`/api/public/forms/${formId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: values.email,
        name: values.name || undefined,
        phone: values.phone || undefined,
        company: values.company || undefined,
        consent: values.consent === "true",
        fields: values,
        utm: {
          source: params.get("utm_source"),
          medium: params.get("utm_medium"),
          campaign: params.get("utm_campaign"),
          content: params.get("utm_content"),
          term: params.get("utm_term")
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Invio non riuscito");
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center text-sm font-medium text-emerald-800">
        {successMessage}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="label" htmlFor={`field-${field.name}`}>
            {field.label}
            {field.required ? <span className="text-rose-500"> *</span> : null}
          </label>
          {field.type === "textarea" ? (
            <textarea
              id={`field-${field.name}`}
              name={field.name}
              required={field.required}
              placeholder={field.placeholder}
              className="textarea"
            />
          ) : field.type === "select" ? (
            <select
              id={`field-${field.name}`}
              name={field.name}
              required={field.required}
              className="input"
              defaultValue=""
            >
              <option value="" disabled>
                Seleziona…
              </option>
              {(field.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : field.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                id={`field-${field.name}`}
                name={field.name}
                type="checkbox"
                value="true"
                required={field.required}
                className="h-4 w-4 rounded border-slate-300"
              />
              {field.placeholder ?? "Accetto il trattamento dei dati"}
            </label>
          ) : (
            <input
              id={`field-${field.name}`}
              name={field.name}
              type={field.type}
              required={field.required}
              placeholder={field.placeholder}
              className="input"
            />
          )}
        </div>
      ))}

      {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Invio…" : submitLabel}
      </button>
      <p className="text-center text-xs text-slate-400">
        I tuoi dati sono al sicuro. Niente spam, promesso.
      </p>
    </form>
  );
}
