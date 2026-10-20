import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/email/mailer";
import { trackEvent } from "@/lib/analytics";
import { getErrorMessage } from "@/lib/utils";

export async function processEmailJob(data: {
  workspaceId: string;
  emailSendId: string;
}) {
  const send = await prisma.emailSend.findFirst({
    where: { id: data.emailSendId, workspaceId: data.workspaceId }
  });
  if (!send) throw new Error("Email send non trovata");
  if (send.status === "SENT" || send.status === "DELIVERED") {
    return { skipped: true, providerId: send.providerId };
  }

  await prisma.emailSend.update({
    where: { id: send.id },
    data: { status: "SENDING", error: null }
  });

  try {
    const result = await sendMail({
      to: send.toEmail,
      subject: send.subject,
      html: send.html
    });

    await prisma.emailSend.update({
      where: { id: send.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerId: result.providerId
      }
    });

    await trackEvent({
      workspaceId: send.workspaceId,
      type: "EMAIL_SENT",
      name: send.subject,
      leadId: send.leadId,
      metadata: { emailSendId: send.id, provider: result.provider }
    });

    if (send.leadId) {
      await prisma.leadEvent.create({
        data: {
          leadId: send.leadId,
          type: "EMAIL_SENT",
          name: send.subject,
          metadata: { emailSendId: send.id }
        }
      });
      await prisma.lead.update({
        where: { id: send.leadId },
        data: { lastActivityAt: new Date() }
      });
    }

    return { providerId: result.providerId, to: send.toEmail };
  } catch (error) {
    await prisma.emailSend.update({
      where: { id: send.id },
      data: { status: "FAILED", error: getErrorMessage(error) }
    });
    throw error;
  }
}
