import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, withApi } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { applyLeadScore, SCORE_POINTS } from "@/lib/leads/scoring";

const emailEventSchema = z.object({
  event: z.enum(["opened", "clicked", "bounced", "delivered"]),
  emailSendId: z.string().optional(),
  providerId: z.string().optional()
});

export const POST = withApi(async (request: NextRequest) => {
  const body = await parseBody(request, emailEventSchema);
  if (!body.emailSendId && !body.providerId) {
    throw new ApiError(422, "emailSendId o providerId obbligatorio");
  }

  const send = await prisma.emailSend.findFirst({
    where: body.emailSendId
      ? { id: body.emailSendId }
      : { providerId: body.providerId }
  });
  if (!send) throw new ApiError(404, "Invio email non trovato");

  const now = new Date();
  await prisma.emailSend.update({
    where: { id: send.id },
    data:
      body.event === "opened"
        ? { status: "OPENED", openedAt: send.openedAt ?? now }
        : body.event === "clicked"
          ? { status: "CLICKED", clickedAt: send.clickedAt ?? now, openedAt: send.openedAt ?? now }
          : body.event === "bounced"
            ? { status: "BOUNCED", error: "Bounced" }
            : { status: "DELIVERED" }
  });

  if (body.event === "opened" || body.event === "clicked") {
    await trackEvent({
      workspaceId: send.workspaceId,
      type: body.event === "opened" ? "EMAIL_OPEN" : "EMAIL_CLICK",
      name: send.subject,
      leadId: send.leadId,
      metadata: { emailSendId: send.id }
    });
    if (send.leadId) {
      await prisma.leadEvent.create({
        data: {
          leadId: send.leadId,
          type: body.event === "opened" ? "EMAIL_OPENED" : "EMAIL_CLICKED",
          name: send.subject,
          metadata: { emailSendId: send.id }
        }
      });
      await applyLeadScore(
        send.leadId,
        body.event === "opened" ? SCORE_POINTS.EMAIL_OPEN : SCORE_POINTS.EMAIL_CLICK,
        body.event === "opened" ? "Email opened" : "Email clicked",
        { emailSendId: send.id }
      ).catch(() => undefined);
    }
  }

  return json({ ok: true });
});
