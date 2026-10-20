import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, noContent, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { landingPageUpdateSchema } from "@/lib/validation/landing";
import { toJson } from "@/lib/utils";

type Context = { params: Promise<{ id: string }> };

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const page = await prisma.landingPage.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      form: true,
      _count: { select: { leads: true } }
    }
  });
  if (!page) throw new ApiError(404, "Landing page non trovata");
  return json({ page });
});

export const PATCH = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.landingPage.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { form: true }
  });
  if (!existing) throw new ApiError(404, "Landing page non trovata");

  const body = await parseBody(request, landingPageUpdateSchema);

  if (body.slug && body.slug !== existing.slug) {
    const collision = await prisma.landingPage.findUnique({ where: { slug: body.slug } });
    if (collision) throw new ApiError(409, "Questo slug è già in uso");
  }

  const page = await prisma.landingPage.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.headline !== undefined ? { headline: body.headline } : {}),
      ...(body.blocks !== undefined ? { blocks: toJson(body.blocks) } : {}),
      ...(body.seoTitle !== undefined ? { seoTitle: body.seoTitle } : {}),
      ...(body.seoDescription !== undefined ? { seoDescription: body.seoDescription } : {}),
      ...(body.customDomain !== undefined ? { customDomain: body.customDomain } : {}),
      ...(body.theme !== undefined ? { theme: toJson(body.theme) } : {}),
      ...(body.published !== undefined
        ? {
            published: body.published,
            publishedAt: body.published ? existing.publishedAt ?? new Date() : null
          }
        : {})
    }
  });

  if (body.form) {
    if (existing.form) {
      await prisma.form.update({
        where: { id: existing.form.id },
        data: {
          ...(body.form.name !== undefined ? { name: body.form.name } : {}),
          ...(body.form.fields !== undefined ? { fields: toJson(body.form.fields) } : {}),
          ...(body.form.submitLabel !== undefined ? { submitLabel: body.form.submitLabel } : {}),
          ...(body.form.successMessage !== undefined
            ? { successMessage: body.form.successMessage }
            : {}),
          ...(body.form.redirectUrl !== undefined ? { redirectUrl: body.form.redirectUrl } : {})
        }
      });
    } else {
      await prisma.form.create({
        data: {
          workspaceId: workspace.id,
          landingPageId: id,
          name: body.form.name ?? `${page.name} form`,
          fields: toJson(body.form.fields),
          submitLabel: body.form.submitLabel ?? "Invia",
          successMessage: body.form.successMessage ?? "Grazie!",
          redirectUrl: body.form.redirectUrl ?? null
        }
      });
    }
  }

  return json({ page });
});

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.landingPage.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Landing page non trovata");
  await prisma.landingPage.delete({ where: { id } });
  return noContent();
});
