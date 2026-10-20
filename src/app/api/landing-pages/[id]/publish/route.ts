import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, requireWorkspace, withApi } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

const publishSchema = z.object({
  published: z.boolean().default(true)
});

export const POST = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const page = await prisma.landingPage.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { form: true }
  });
  if (!page) throw new ApiError(404, "Landing page non trovata");

  const body = await parseBody(request, publishSchema);
  if (body.published && !page.form) {
    throw new ApiError(422, "Aggiungi un form prima di pubblicare la pagina");
  }

  const updated = await prisma.landingPage.update({
    where: { id },
    data: {
      published: body.published,
      publishedAt: body.published ? page.publishedAt ?? new Date() : null
    }
  });
  return json({ page: updated });
});
