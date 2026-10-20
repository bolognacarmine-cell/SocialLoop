import type { Lead, LeadTag, Tag } from "@prisma/client";
import { prisma } from "@/lib/db";
import { asRecord } from "@/lib/utils";
import type { WorkflowContext } from "./types";

export type LeadWithTags = Lead & { tags: Array<LeadTag & { tag: Tag }> };

export function leadToContext(lead: LeadWithTags): WorkflowContext {
  const utm = asRecord(lead.utm);
  return {
    leadId: lead.id,
    email: lead.email,
    name: lead.name,
    phone: lead.phone,
    company: lead.company,
    jobTitle: lead.jobTitle,
    stage: lead.stage,
    score: lead.score,
    source: lead.source,
    consent: lead.consent,
    campaignId: lead.campaignId,
    landingPageId: lead.landingPageId,
    socialPostId: lead.socialPostId,
    tags: lead.tags.map((item) => item.tag.name),
    utm,
    custom: asRecord(lead.customFields),
    ...Object.fromEntries(
      Object.entries(asRecord(lead.customFields)).map(([key, value]) => [`custom.${key}`, value])
    )
  };
}

export async function buildLeadContext(leadId: string): Promise<WorkflowContext | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { tags: { include: { tag: true } } }
  });
  if (!lead) return null;
  return leadToContext(lead);
}

export async function buildRunContext(
  leadId: string | null,
  baseContext: Record<string, unknown>
): Promise<WorkflowContext> {
  const leadContext = leadId ? await buildLeadContext(leadId) : null;
  return { ...baseContext, ...(leadContext ?? {}) };
}

export function getLeadIdFromContext(context: Record<string, unknown>): string | null {
  return typeof context.leadId === "string" ? context.leadId : null;
}
