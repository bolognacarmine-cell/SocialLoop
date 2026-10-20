import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { landingPageCreateSchema } from "@/lib/validation/landing";
import { slugify, toJson } from "@/lib/utils";

const DEFAULT_FIELDS = [
  { name: "email", label: "Email", type: "email", required: true },
  { name: "name", label: "Nome", type: "text", required: false }
];

const DEFAULT_BLOCKS = (headline: string) => [
  {
    id: "hero",
    type: "hero",
    title: headline,
    text: "Scarica la guida gratuita e scopri il metodo SocialLoop.",
    ctaLabel: "Ricevi la guida",
    ctaUrl: "#form",
    align: "center"
  },
  {
    id: "features",
    type: "features",
    title: "Cosa ricevi",
    items: [
      "Una checklist operativa pronta all'uso",
      "Template per contenuti e campagne",
      "Esempi di funnel che convertono"
    ]
  },
  {
    id: "form",
    type: "form",
    title: "Accedi alla risorsa",
    text: "Compila il form e ricevi subito il materiale via email."
  }
];

export const GET = withApi(async () => {
  const { workspace } = await requireWorkspace();
  const pages = await prisma.landingPage.findMany({
    where: { workspaceId: workspace.id },
    include: {
      form: true,
      _count: { select: { leads: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
  return json({ pages });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const body = await parseBody(request, landingPageCreateSchema);
  const baseSlug = body.slug ?? slugify(body.name);
  const slug = body.slug ?? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const collision = await prisma.landingPage.findUnique({ where: { slug } });
  if (collision) throw new ApiError(409, "Questo slug è già in uso");

  const formInput = body.form ?? {
    name: `${body.name} form`,
    fields: DEFAULT_FIELDS,
    submitLabel: "Ricevi l'offerta",
    successMessage: "Grazie! Controlla la tua inbox.",
    redirectUrl: null
  };

  const page = await prisma.landingPage.create({
    data: {
      workspaceId: workspace.id,
      name: body.name,
      slug,
      headline: body.headline ?? body.name,
      blocks: toJson(body.blocks.length ? body.blocks : DEFAULT_BLOCKS(body.headline ?? body.name)),
      seoTitle: body.seoTitle ?? body.name,
      seoDescription: body.seoDescription ?? null,
      customDomain: body.customDomain ?? null,
      theme: toJson(body.theme),
      published: body.published,
      publishedAt: body.published ? new Date() : null,
      form: {
        create: {
          workspaceId: workspace.id,
          name: formInput.name,
          fields: toJson(formInput.fields),
          submitLabel: formInput.submitLabel,
          successMessage: formInput.successMessage,
          redirectUrl: formInput.redirectUrl ?? null
        }
      }
    },
    include: { form: true }
  });

  return json({ page }, { status: 201 });
});
