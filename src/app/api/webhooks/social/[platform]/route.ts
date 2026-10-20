import type { NextRequest } from "next/server";
import { SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { getSocialAdapter } from "@/lib/social/registry";
import { getErrorMessage } from "@/lib/utils";

type Context = { params: Promise<{ platform: string }> };

function headersToRecord(request: NextRequest) {
  const record: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

export const POST = withApi<Context>(async (request: NextRequest, { params }) => {
  const { platform: rawPlatform } = await params;
  const platform = rawPlatform.toUpperCase() as SocialPlatform;
  if (!Object.values(SocialPlatform).includes(platform)) {
    return json({ error: "Piattaforma non supportata" }, { status: 400 });
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { raw: rawBody };
  }

  const adapter = getSocialAdapter(platform);
  const headers = headersToRecord(request);
  if (!adapter.verifyWebhook({ rawBody, headers, payload })) {
    return json({ error: "Firma webhook non valida" }, { status: 401 });
  }

  const event = adapter.parseWebhook(payload, headers);
  const account = event.accountExternalId
    ? await prisma.socialAccount.findFirst({
        where: { platform, externalId: event.accountExternalId }
      })
    : null;
  const workspaceId = account?.workspaceId ?? null;

  let webhook;
  try {
    webhook = await prisma.webhookEvent.create({
      data: {
        workspaceId,
        platform,
        eventType: event.type,
        externalId: event.externalId ?? event.postExternalId ?? null,
        payload: payload as object,
        headers: headers as object,
        status: "RECEIVED"
      }
    });
  } catch {
    // Duplicate externalId: acknowledge to stop provider retries.
    return json({ ok: true, duplicate: true });
  }

  try {
    const remotePostId = event.postExternalId;
    if (remotePostId) {
      const target = await prisma.postTarget.findFirst({ where: { remotePostId, platform } });
      if (target) {
        await prisma.postTarget.update({
          where: { id: target.id },
          data: {
            status: event.status === "failed" ? "FAILED" : "PUBLISHED",
            error: event.status === "failed" ? "Webhook provider error" : null
          }
        });
      }
    }
    await prisma.webhookEvent.update({
      where: { id: webhook.id },
      data: { status: "PROCESSED", processedAt: new Date() }
    });
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: webhook.id },
      data: { status: "FAILED", error: getErrorMessage(error) }
    });
  }

  return json({ ok: true, eventId: webhook.id });
});
