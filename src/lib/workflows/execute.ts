import type { SocialPlatform } from "@prisma/client";
import { LeadStage, SocialPlatform as SocialPlatformEnum } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueueEmail, enqueueWorkflow } from "@/lib/queue/queues";
import { applyLeadScore } from "@/lib/leads/scoring";
import { syncLeadSegments } from "@/lib/leads/segments";
import { asArray, asRecord, getErrorMessage } from "@/lib/utils";
import { buildRunContext, getLeadIdFromContext } from "./context";
import { evaluateConditionGroup } from "./conditions";
import type { WorkflowAction as Action, WorkflowStep } from "./types";

function delayToMs(delay: { amount: number; unit: "minutes" | "hours" | "days" }) {
  const factor = delay.unit === "days" ? 86_400_000 : delay.unit === "hours" ? 3_600_000 : 60_000;
  return delay.amount * factor;
}

function assertSafeWebhookUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("I webhook devono usare HTTPS");
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith(".local");
  if (blocked) throw new Error("URL webhook non consentito (rete privata)");
  return url;
}

async function executeAction(
  action: Action,
  context: Record<string, unknown>,
  run: { id: string; workspaceId: string; leadId: string | null; workflowId: string }
) {
  const leadId = run.leadId ?? getLeadIdFromContext(context);

  switch (action.type) {
    case "send_email": {
      if (!leadId) throw new Error("send_email richiede un lead");
      if (!action.templateId) throw new Error("Seleziona un template email");
      const [lead, template] = await Promise.all([
        prisma.lead.findFirst({ where: { id: leadId, workspaceId: run.workspaceId } }),
        prisma.emailTemplate.findFirst({
          where: { id: action.templateId, workspaceId: run.workspaceId }
        })
      ]);
      if (!lead) throw new Error("Lead non trovato");
      if (!template) throw new Error("Template email non trovato");

      const send = await prisma.emailSend.create({
        data: {
          workspaceId: run.workspaceId,
          leadId: lead.id,
          templateId: template.id,
          workflowRunId: run.id,
          toEmail: lead.email,
          subject: template.subject,
          html: template.html,
          status: "QUEUED"
        }
      });
      try {
        await enqueueEmail({ workspaceId: run.workspaceId, emailSendId: send.id });
      } catch (error) {
        await prisma.emailSend
          .update({ where: { id: send.id }, data: { status: "FAILED", error: getErrorMessage(error) } })
          .catch(() => undefined);
        throw error;
      }
      await prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          type: "EMAIL_QUEUED",
          name: template.subject,
          metadata: { emailSendId: send.id, templateId: template.id }
        }
      });
      return { emailSendId: send.id, to: lead.email };
    }

    case "add_tag": {
      if (!leadId) throw new Error("add_tag richiede un lead");
      if (!action.tagName) throw new Error("Nome tag obbligatorio");
      const tag = await prisma.tag.upsert({
        where: { workspaceId_name: { workspaceId: run.workspaceId, name: action.tagName } },
        create: { workspaceId: run.workspaceId, name: action.tagName },
        update: {}
      });
      await prisma.leadTag.upsert({
        where: { leadId_tagId: { leadId, tagId: tag.id } },
        create: { leadId, tagId: tag.id },
        update: {}
      });
      await prisma.leadEvent.create({
        data: { leadId, type: "TAG_ADDED", name: tag.name }
      });
      await syncLeadSegments(leadId);
      return { tagId: tag.id, name: tag.name };
    }

    case "remove_tag": {
      if (!leadId) throw new Error("remove_tag richiede un lead");
      if (!action.tagName) throw new Error("Nome tag obbligatorio");
      const tag = await prisma.tag.findUnique({
        where: { workspaceId_name: { workspaceId: run.workspaceId, name: action.tagName } }
      });
      if (tag) {
        await prisma.leadTag
          .delete({ where: { leadId_tagId: { leadId, tagId: tag.id } } })
          .catch(() => undefined);
        await prisma.leadEvent.create({
          data: { leadId, type: "TAG_REMOVED", name: tag.name }
        });
      }
      await syncLeadSegments(leadId);
      return { tagName: action.tagName, removed: Boolean(tag) };
    }

    case "update_score": {
      if (!leadId) throw new Error("update_score richiede un lead");
      const updated = await applyLeadScore(
        leadId,
        action.amount ?? 0,
        action.reason ?? "Workflow automation",
        { workflowRunId: run.id }
      );
      await prisma.leadEvent.create({
        data: {
          leadId,
          type: "SCORE_UPDATED",
          name: action.reason ?? "Workflow automation",
          metadata: { amount: action.amount ?? 0, score: updated.score }
        }
      });
      await syncLeadSegments(leadId);
      return { score: updated.score };
    }

    case "set_stage": {
      if (!leadId) throw new Error("set_stage richiede un lead");
      const stage = action.stage as LeadStage;
      if (!Object.values(LeadStage).includes(stage)) throw new Error("Stage non valido");
      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: { stage, lastActivityAt: new Date() }
      });
      await prisma.leadEvent.create({
        data: { leadId, type: "STAGE_CHANGED", name: stage, metadata: { stage } }
      });
      await syncLeadSegments(leadId);
      return { stage: updated.stage };
    }

    case "add_to_segment": {
      if (!leadId) throw new Error("add_to_segment richiede un lead");
      if (!action.segmentId) throw new Error("Segmento obbligatorio");
      const segment = await prisma.segment.findFirst({
        where: { id: action.segmentId, workspaceId: run.workspaceId }
      });
      if (!segment) throw new Error("Segmento non trovato");
      await prisma.segmentMembership.upsert({
        where: { segmentId_leadId: { segmentId: segment.id, leadId } },
        create: { segmentId: segment.id, leadId },
        update: {}
      });
      await prisma.leadEvent.create({
        data: { leadId, type: "SEGMENT_ADDED", name: segment.name }
      });
      return { segmentId: segment.id, name: segment.name };
    }

    case "add_to_retargeting": {
      if (!leadId) throw new Error("add_to_retargeting richiede un lead");
      const name = action.audienceName ?? "Retargeting workflow";
      let audience = await prisma.retargetingAudience.findFirst({
        where: { workspaceId: run.workspaceId, name }
      });
      if (!audience) {
        audience = await prisma.retargetingAudience.create({
          data: {
            workspaceId: run.workspaceId,
            name,
            platform: (action.platform as SocialPlatform | undefined) ?? "FACEBOOK",
            campaignId: action.campaignId ?? null,
            filter: { source: "workflow", workflowRunId: run.id }
          }
        });
      }
      await prisma.retargetingAudienceMember.upsert({
        where: { audienceId_leadId: { audienceId: audience.id, leadId } },
        create: { audienceId: audience.id, leadId },
        update: {}
      });
      await prisma.leadEvent.create({
        data: { leadId, type: "RETARGETING_ADDED", name: audience.name }
      });
      return { audienceId: audience.id, name: audience.name };
    }

    case "create_social_post": {
      if (!action.body?.trim()) throw new Error("Contenuto social obbligatorio");
      const accountIds = action.socialAccountIds ?? [];
      const accounts = accountIds.length
        ? await prisma.socialAccount.findMany({
            where: {
              workspaceId: run.workspaceId,
              id: { in: accountIds },
              status: "CONNECTED"
            },
            select: { id: true, platform: true }
          })
        : [];

      const scheduleMinutes = action.scheduledInMinutes ?? 0;
      const shouldSchedule = scheduleMinutes > 0 && accounts.length > 0;
      const post = await prisma.post.create({
        data: {
          workspaceId: run.workspaceId,
          campaignId: action.campaignId ?? null,
          body: action.body,
          status: shouldSchedule ? "SCHEDULED" : "DRAFT",
          scheduledAt: shouldSchedule
            ? new Date(Date.now() + scheduleMinutes * 60_000)
            : null,
          targets: {
            create: accounts.map((account) => ({
              socialAccountId: account.id,
              platform: account.platform
            }))
          }
        }
      });
      return { postId: post.id, status: post.status };
    }

    case "send_webhook": {
      if (!action.url) throw new Error("URL webhook obbligatorio");
      const url = assertSafeWebhookUrl(action.url);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "socialloop.workflow",
          runId: run.id,
          leadId,
          data: context
        }),
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) throw new Error(`Webhook response ${response.status}`);
      return { status: response.status };
    }

    default:
      throw new Error(
        `Azione workflow non supportata: ${(action as { type?: string }).type ?? "unknown"}`
      );
  }
}

export async function executeWorkflowRun(runId: string) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { workflow: true }
  });
  if (!run) throw new Error("Workflow run non trovato");
  if (run.status === "COMPLETED" || run.status === "CANCELLED") {
    return { status: run.status, skipped: true };
  }
  if (run.workflow.status === "ARCHIVED") {
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "CANCELLED", finishedAt: new Date() }
    });
    return { status: "CANCELLED", skipped: true };
  }

  const steps = asArray<WorkflowStep>(run.workflow.steps);
  let index = run.currentStep;

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: { status: "RUNNING", startedAt: run.startedAt ?? new Date(), error: null }
  });

  while (index < steps.length) {
    const step = steps[index];

    const existingStep = await prisma.workflowRunStep.findUnique({
      where: { runId_stepIndex: { runId: run.id, stepIndex: index } }
    });
    if (existingStep?.status === "COMPLETED") {
      index += 1;
      continue;
    }

    await prisma.workflowRunStep.upsert({
      where: { runId_stepIndex: { runId: run.id, stepIndex: index } },
      create: {
        runId: run.id,
        stepIndex: index,
        type: step.type,
        status: "RUNNING"
      },
      update: { status: "RUNNING", error: null }
    });

    try {
      const context = await buildRunContext(run.leadId, asRecord(run.context));

      if (step.type === "condition") {
        const passed = evaluateConditionGroup(step.condition, context);
        await prisma.workflowRunStep.update({
          where: { runId_stepIndex: { runId: run.id, stepIndex: index } },
          data: {
            status: "COMPLETED",
            output: { passed },
            executedAt: new Date()
          }
        });
        if (!passed) {
          await prisma.workflowRun.update({
            where: { id: run.id },
            data: {
              status: "COMPLETED",
              currentStep: steps.length,
              finishedAt: new Date()
            }
          });
          return { status: "COMPLETED", stoppedByCondition: true, step: index };
        }
        index += 1;
        await prisma.workflowRun.update({ where: { id: run.id }, data: { currentStep: index } });
        continue;
      }

      if (step.type === "delay") {
        if (!step.delay) throw new Error("Delay non configurato");
        const delayMs = delayToMs(step.delay);
        const nextRunAt = new Date(Date.now() + delayMs);

        await prisma.workflowRun.update({
          where: { id: run.id },
          data: {
            status: "WAITING",
            currentStep: index + 1,
            nextRunAt
          }
        });

        try {
          await enqueueWorkflow({
            workspaceId: run.workspaceId,
            workflowRunId: run.id,
            delay: delayMs
          });
        } catch (error) {
          await prisma.workflowRun.update({
            where: { id: run.id },
            data: { status: "RUNNING", currentStep: index, nextRunAt: null }
          });
          throw error;
        }

        await prisma.workflowRunStep.update({
          where: { runId_stepIndex: { runId: run.id, stepIndex: index } },
          data: {
            status: "COMPLETED",
            output: { delayMs, nextRunAt: nextRunAt.toISOString() },
            executedAt: new Date()
          }
        });

        return { status: "WAITING", nextRunAt, step: index };
      }

      if (step.type === "action") {
        if (!step.action) throw new Error("Azione non configurata");
        const output = await executeAction(step.action as Action, context, {
          id: run.id,
          workspaceId: run.workspaceId,
          leadId: run.leadId,
          workflowId: run.workflowId
        });

        await prisma.workflowRunStep.update({
          where: { runId_stepIndex: { runId: run.id, stepIndex: index } },
          data: {
            status: "COMPLETED",
            output: output as object,
            executedAt: new Date()
          }
        });

        index += 1;
        await prisma.workflowRun.update({ where: { id: run.id }, data: { currentStep: index } });
        continue;
      }

      throw new Error(`Tipo step non supportato: ${(step as { type?: string }).type ?? "unknown"}`);
    } catch (error) {
      await prisma.workflowRunStep.update({
        where: { runId_stepIndex: { runId: run.id, stepIndex: index } },
        data: { status: "FAILED", error: getErrorMessage(error), executedAt: new Date() }
      });
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "FAILED", error: getErrorMessage(error), finishedAt: new Date() }
      });
      throw error;
    }
  }

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      currentStep: steps.length,
      finishedAt: new Date(),
      nextRunAt: null
    }
  });

  return { status: "COMPLETED", steps: steps.length };
}

export function isValidPlatform(value: string): value is SocialPlatform {
  return Object.values(SocialPlatformEnum).includes(value as SocialPlatform);
}
