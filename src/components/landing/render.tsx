import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LandingBlock = {
  id: string;
  type: string;
  title?: string | null;
  text?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  align?: string | null;
  items?: unknown;
};

function asItems(items: unknown): string[] {
  return Array.isArray(items) ? items.filter((item): item is string => typeof item === "string") : [];
}

function alignClass(align: string | null | undefined) {
  return align === "center" ? "text-center items-center" : "text-left items-start";
}

function CtaButton({ label, url }: { label?: string | null; url?: string | null }) {
  if (!label) return null;
  return (
    <a
      href={url ?? "#lead-form"}
      className="inline-flex rounded-xl bg-loop-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-loop-600/20 transition hover:bg-loop-700"
    >
      {label}
    </a>
  );
}

export function LandingBlockView({ block }: { block: LandingBlock }) {
  const align = alignClass(block.align);
  switch (block.type) {
    case "hero":
      return (
        <section className={cn("mx-auto flex w-full max-w-3xl flex-col gap-5 py-10", align)}>
          {block.title ? (
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {block.title}
            </h1>
          ) : null}
          {block.text ? <p className="text-lg text-slate-600">{block.text}</p> : null}
          <CtaButton label={block.ctaLabel} url={block.ctaUrl} />
        </section>
      );
    case "text":
      return (
        <section className={cn("mx-auto flex w-full max-w-2xl flex-col gap-3 py-6", align)}>
          {block.title ? <h2 className="text-2xl font-semibold text-slate-900">{block.title}</h2> : null}
          {block.text ? <p className="whitespace-pre-line text-base text-slate-600">{block.text}</p> : null}
        </section>
      );
    case "image":
      return (
        <section className="mx-auto w-full max-w-3xl py-6">
          {block.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.imageUrl}
              alt={block.title ?? ""}
              className="w-full rounded-2xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
              Immagine non configurata
            </div>
          )}
          {block.title ? (
            <p className="mt-3 text-center text-sm text-slate-500">{block.title}</p>
          ) : null}
        </section>
      );
    case "features":
      return (
        <section className="mx-auto w-full max-w-4xl py-8">
          {block.title ? (
            <h2 className="mb-5 text-center text-2xl font-semibold text-slate-900">{block.title}</h2>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            {asItems(block.items).map((item, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-base font-medium text-slate-800">{item}</p>
              </div>
            ))}
          </div>
        </section>
      );
    case "testimonial":
      return (
        <section className="mx-auto w-full max-w-2xl py-8">
          <blockquote className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            {block.text ? <p className="text-lg italic text-slate-700">“{block.text}”</p> : null}
            {block.title ? (
              <footer className="mt-3 text-sm font-semibold text-slate-500">— {block.title}</footer>
            ) : null}
          </blockquote>
        </section>
      );
    case "faq":
      return (
        <section className="mx-auto w-full max-w-2xl py-8">
          {block.title ? (
            <h2 className="mb-4 text-2xl font-semibold text-slate-900">{block.title}</h2>
          ) : null}
          <div className="space-y-3">
            {asItems(block.items).map((item, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>
      );
    case "cta":
      return (
        <section className={cn("mx-auto flex w-full max-w-2xl flex-col gap-4 py-8", align)}>
          {block.title ? <h2 className="text-2xl font-semibold text-slate-900">{block.title}</h2> : null}
          {block.text ? <p className="text-slate-600">{block.text}</p> : null}
          <CtaButton label={block.ctaLabel} url={block.ctaUrl} />
        </section>
      );
    case "form":
      return (
        <section id="lead-form" className="mx-auto w-full max-w-xl py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            {block.title ? (
              <h2 className="mb-1 text-xl font-semibold text-slate-900">{block.title}</h2>
            ) : null}
            {block.text ? <p className="mb-4 text-sm text-slate-500">{block.text}</p> : null}
            {block.ctaLabel ? (
              <p className="text-sm font-medium text-loop-700">{block.ctaLabel}</p>
            ) : null}
          </div>
        </section>
      );
    default:
      return null;
  }
}

export function LandingRenderer({ blocks }: { blocks: LandingBlock[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((block) => (
        <LandingBlockView key={block.id} block={block} />
      ))}
    </div>
  );
}

export function PageShell({
  children,
  theme
}: {
  children: ReactNode;
  theme?: { primary?: string } | null;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8">{children}</div>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Creato con SocialLoop
      </footer>
    </div>
  );
}
