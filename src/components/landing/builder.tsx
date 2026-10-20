"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, Plus, Save, Trash2, Upload } from "lucide-react";
import { LandingRenderer, type LandingBlock } from "@/components/landing/render";

const BLOCK_LABELS: Record<string, string> = {
  hero: "Hero",
  text: "Testo",
  image: "Immagine",
  features: "Vantaggi",
  testimonial: "Testimonianza",
  faq: "FAQ",
  cta: "Call to action",
  form: "Form lead"
};

type BuilderPage = {
  id: string;
  name: string;
  slug: string;
  headline: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  published: boolean;
  blocks: LandingBlock[];
};

export function LandingPageBuilder({ page, appUrl }: { page: BuilderPage; appUrl: string }) {
  const router = useRouter();
  const [name, setName] = useState(page.name);
  const [slug, setSlug] = useState(page.slug);
  const [headline, setHeadline] = useState(page.headline ?? "");
  const [seoTitle, setSeoTitle] = useState(page.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seoDescription ?? "");
  const [blocks, setBlocks] = useState<LandingBlock[]>(page.blocks);
  const [published, setPublished] = useState(page.published);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateBlock(id: string, patch: Partial<LandingBlock>) {
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  }

  function addBlock(type: string) {
    setBlocks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type,
        title: BLOCK_LABELS[type] ?? type,
        text: "",
        align: "left"
      }
    ]);
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  function move(id: string, direction: -1 | 1) {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setStatus(null);
    const response = await fetch(`/api/landing-pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug,
        headline: headline || null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        blocks
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Salvataggio non riuscito");
    } else {
      setStatus("Modifiche salvate.");
      router.refresh();
    }
    setBusy(false);
  }

  async function togglePublish() {
    setBusy(true);
    setError(null);
    setStatus(null);
    await save();
    const response = await fetch(`/api/landing-pages/${page.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !published })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Operazione non riuscita");
    } else {
      setPublished(!published);
      setStatus(!published ? "Landing page pubblicata." : "Landing page messa in bozza.");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <div className="card card-pad space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome interno</label>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <label className="label">Slug</label>
              <input className="input" value={slug} onChange={(event) => setSlug(event.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Headline</label>
            <input
              className="input"
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder="Il titolo principale della pagina"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">SEO title</label>
              <input className="input" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
            </div>
            <div>
              <label className="label">SEO description</label>
              <input
                className="input"
                value={seoDescription}
                onChange={(event) => setSeoDescription(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Blocchi di contenuto</h2>
              <p className="text-sm text-slate-500">Costruisci la pagina trascinando le sezioni.</p>
            </div>
            <select
              className="input !w-auto"
              value=""
              onChange={(event) => {
                if (event.target.value) addBlock(event.target.value);
              }}
            >
              <option value="">+ Aggiungi blocco…</option>
              {Object.entries(BLOCK_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="divide-y divide-slate-100">
            {blocks.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                Nessun blocco. Aggiungine uno per iniziare.
              </p>
            ) : (
              blocks.map((block, index) => (
                <div key={block.id} className="space-y-3 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="badge bg-loop-100 text-loop-700">
                      {BLOCK_LABELS[block.type] ?? block.type}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(block.id, -1)}
                        disabled={index === 0}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(block.id, 1)}
                        disabled={index === blocks.length - 1}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {["hero", "text", "cta", "features", "faq", "testimonial", "image", "form"].includes(
                    block.type
                  ) ? (
                    <input
                      className="input"
                      placeholder="Titolo"
                      value={block.title ?? ""}
                      onChange={(event) => updateBlock(block.id, { title: event.target.value })}
                    />
                  ) : null}

                  {["hero", "text", "cta", "testimonial", "form"].includes(block.type) ? (
                    <textarea
                      className="textarea"
                      placeholder="Testo"
                      value={block.text ?? ""}
                      onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                    />
                  ) : null}

                  {block.type === "image" ? (
                    <input
                      className="input"
                      placeholder="URL immagine (https://…)"
                      value={block.imageUrl ?? ""}
                      onChange={(event) => updateBlock(block.id, { imageUrl: event.target.value })}
                    />
                  ) : null}

                  {["features", "faq"].includes(block.type) ? (
                    <textarea
                      className="textarea"
                      placeholder="Un elemento per riga"
                      value={Array.isArray(block.items) ? (block.items as string[]).join("\n") : ""}
                      onChange={(event) =>
                        updateBlock(block.id, {
                          items: event.target.value.split("\n").filter((line) => line.trim().length > 0)
                        })
                      }
                    />
                  ) : null}

                  {["hero", "cta"].includes(block.type) ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className="input"
                        placeholder="Testo bottone"
                        value={block.ctaLabel ?? ""}
                        onChange={(event) => updateBlock(block.id, { ctaLabel: event.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="URL bottone (o #lead-form)"
                        value={block.ctaUrl ?? ""}
                        onChange={(event) => updateBlock(block.id, { ctaUrl: event.target.value })}
                      />
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
              <button
                type="button"
                onClick={() => void togglePublish()}
                disabled={busy}
                className={published ? "btn-secondary" : "btn-secondary"}
              >
                <Upload className="h-4 w-4" /> {published ? "Metti in bozza" : "Pubblica"}
              </button>
              <a
                href={`${appUrl}/l/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                <Eye className="h-4 w-4" /> Anteprima
              </a>
            </div>
            <span
              className={`badge ${published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
            >
              {published ? "Pubblicata" : "Bozza"}
            </span>
          </div>
          {error ? (
            <p className="mx-5 mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
          {status ? (
            <p className="mx-5 mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {status}
            </p>
          ) : null}
        </div>
      </div>

      <div className="xl:sticky xl:top-6">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-2 truncate text-xs text-slate-400">{appUrl}/l/{slug}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto bg-white p-6">
            <LandingRenderer blocks={blocks} />
          </div>
        </div>
      </div>
    </div>
  );
}
