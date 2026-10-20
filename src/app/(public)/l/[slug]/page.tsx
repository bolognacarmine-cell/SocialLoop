import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { asArray, asRecord } from "@/lib/utils";
import { LandingRenderer, PageShell, type LandingBlock } from "@/components/landing/render";
import { LeadForm } from "@/components/landing/lead-form";

type Params = { params: Promise<{ slug: string }> };

type StoredField = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.landingPage.findUnique({ where: { slug } });
  if (!page) return { title: "Pagina non trovata" };
  return {
    title: page.seoTitle ?? page.headline ?? page.name,
    description: page.seoDescription ?? undefined
  };
}

export default async function PublicLandingPage({ params }: Params) {
  const { slug } = await params;
  const page = await prisma.landingPage.findUnique({
    where: { slug },
    include: { form: true }
  });

  if (!page || !page.published) notFound();

  const blocks = asArray<LandingBlock>(page.blocks);
  const theme = asRecord(page.theme);
  const formFields = page.form ? asArray<StoredField>(page.form.fields) : [];

  return (
    <PageShell>
      <LandingRenderer blocks={blocks} />
      {page.form && formFields.length > 0 ? (
        <div id="lead-form" className="mx-auto mt-6 w-full max-w-xl scroll-mt-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <LeadForm
              formId={page.form.id}
              fields={formFields}
              submitLabel={page.form.submitLabel}
              successMessage={page.form.successMessage}
              redirectUrl={page.form.redirectUrl}
            />
          </div>
        </div>
      ) : null}
      {!theme ? null : null}
    </PageShell>
  );
}
