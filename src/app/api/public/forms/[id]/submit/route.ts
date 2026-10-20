import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, withApi } from "@/lib/api";
import { publicLeadSubmissionSchema } from "@/lib/validation/lead";
import { calculateInitialScore, applyLeadScore, SCORE_POINTS } from "@/lib/leads/scoring";
import { trackEvent } from "@/lib/analytics";
import { rateLimit } from "@/lib/rate-limit";
import { syncLeadSegments } from "@/lib/leads/segments";
import { triggerWorkflows } from "@/lib/workflows/engine";
import { asArray, asRecord, toJson } from "@/lib/utils";

type Context = { params: Promise<{ id: string }> };

type FormField = { name: string; label: string; required?: boolean; type?: string };

export const POST = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const form = await prisma.form.findUnique({
    where: { id },
    include: { landingPage: true, workspace: true }
  });
  if (!form || !form.landingPage.published) {
    throw new ApiError(404, "Form non disponibile");
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`form:${form.id}:${ip}`, 10, 60_000);
  if (!limit.allowed) {
    throw new ApiError(429, "Troppe richieste. Riprova tra poco.");
  }

  const body = await parseBody(request, publicLeadSubmissionSchema);

  const fields = asArray<FormField>(form.fields);
  const missing = fields
    .filter((field) => field.required)
    .filter((field) => {
      if (field.name === "email") return !body.email;
      return !body.fields[field.name];
    })
    .map((field) => field.label);
  if (missing.length > 0) {
    throw new ApiError(422, `Campi obbligatori mancanti: ${missing.join(", ")}`);
  }

  if (body.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: body.campaignId, workspaceId: form.workspaceId }
    });
    if (!campaign) throw new ApiError(422, "Campagna non valida");
  }
  if (body.socialPostId) {
    const post = await prisma.post.findFirst({
      where: { id: body.socialPostId, workspaceId: form.workspaceId }
    });
    if (!post) throw new ApiError(422, "Post social non valido");
  }

  const workspaceId = form.workspaceId;
  const existing = await prisma.lead.findUnique({
    where: { workspaceId_email: { workspaceId, email: body.email } }
  });

  const lead = existing
    ? await prisma.lead.update({
        where: { id: existing.id },
        data: {
          name: body.name ?? existing.name,
          phone: body.phone ?? existing.phone,
          company: body.company ?? existing.company,
          consent: body.consent,
          lastActivityAt: new Date(),
          customFields: toJson({
            ...asRecord(existing.customFields),
            ...body.fields
          }),
          utm: toJson({ ...asRecord(existing.utm), ...body.utm }),
          campaignId: body.campaignId ?? existing.campaignId,
          socialPostId: body.socialPostId ?? existing.socialPostId
        }
      })
    : await prisma.lead.create({
        data: {
          workspaceId,
          email: body.email,
          name: body.name ?? null,
          phone: body.phone ?? null,
          company: body.company ?? null,
          stage: "NEW",
          source: "LANDING_PAGE",
          campaignId: body.campaignId ?? null,
          landingPageId: form.landingPageId,
          socialPostId: body.socialPostId ?? null,
          formId: form.id,
          consent: body.consent,
          utm: toJson(body.utm),
          customFields: toJson(body.fields),
          score: calculateInitialScore({
            email: body.email,
            name: body.name,
            phone: body.phone,
            company: body.company,
            source: "LANDING_PAGE"
          }),
          lastActivityAt: new Date()
        }
      });

  await prisma.formSubmission.create({
    data: {
      formId: form.id,
      leadId: lead.id,
      data: toJson({
        email: body.email,
        name: body.name ?? null,
        phone: body.phone ?? null,
        company: body.company ?? null,
        consent: body.consent,
        ...body.fields
      }),
      ip,
      userAgent: request.headers.get("user-agent") ?? undefined
    }
  });

  await applyLeadScore(lead.id, SCORE_POINTS.FORM_SUBMITTED, "Form submission", {
    formId: form.id
  }).catch(() => undefined);

  await prisma.leadEvent.create({
    data: {
      leadId: lead.id,
      type: "FORM_SUBMITTED",
      name: form.name,
      metadata: { formId: form.id, landingPageId: form.landingPageId }
    }
  });

  if (!existing) {
    await trackEvent({
      workspaceId,
      type: "LEAD_CREATED",
      name: "Landing page lead",
      leadId: lead.id,
      campaignId: lead.campaignId,
      landingPageId: form.landingPageId,
      socialPostId: lead.socialPostId,
      metadata: { source: "LANDING_PAGE", email: lead.email }
    });
  }
  await trackEvent({
    workspaceId,
    type: "FORM_SUBMISSION",
    name: form.name,
    leadId: lead.id,
    campaignId: lead.campaignId,
    landingPageId: form.landingPageId,
    socialPostId: lead.socialPostId,
    metadata: { formId: form.id, fields: Object.keys(body.fields) }
  });

  await syncLeadSegments(lead.id).catch(() => undefined);

  const workflowContext = {
    formId: form.id,
    landingPageId: form.landingPageId,
    utm: body.utm
  };
  await triggerWorkflows({
    workspaceId,
    triggerType: "FORM_SUBMITTED",
    leadId: lead.id,
    context: workflowContext
  }).catch(() => undefined);

  if (!existing) {
    await triggerWorkflows({
      workspaceId,
      triggerType: "LEAD_CREATED",
      leadId: lead.id,
      context: { source: "LANDING_PAGE" }
    }).catch(() => undefined);
  }

  return json(
    {
      ok: true,
      leadId: lead.id,
      message: form.successMessage,
      redirectUrl: form.redirectUrl
    },
    { status: 201 }
  );
});
