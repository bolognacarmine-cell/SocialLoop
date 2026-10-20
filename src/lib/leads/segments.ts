import { prisma } from "@/lib/db";
import { evaluateConditionGroup } from "@/lib/workflows/conditions";
import type { ConditionGroup } from "@/lib/workflows/types";
import { leadToContext, type LeadWithTags } from "@/lib/workflows/context";

export function leadMatchesRules(lead: LeadWithTags, rules: unknown): boolean {
  const group = rules as ConditionGroup;
  if (!group || !Array.isArray(group.rules)) return false;
  return evaluateConditionGroup(group, leadToContext(lead));
}

export async function syncSegment(segmentId: string) {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (!segment) throw new Error("Segmento non trovato");

  const leads = await prisma.lead.findMany({
    where: { workspaceId: segment.workspaceId },
    include: { tags: { include: { tag: true } } }
  });

  const matching = leads.filter((lead) => leadMatchesRules(lead, segment.rules)).map((lead) => lead.id);

  await prisma.$transaction([
    prisma.segmentMembership.deleteMany({
      where: { segmentId, leadId: { notIn: matching.length ? matching : ["__none__"] } }
    }),
    ...matching.map((leadId) =>
      prisma.segmentMembership.upsert({
        where: { segmentId_leadId: { segmentId, leadId } },
        create: { segmentId, leadId },
        update: {}
      })
    )
  ]);

  return { count: matching.length };
}

export async function syncLeadSegments(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { tags: { include: { tag: true } } }
  });
  if (!lead) return;

  const segments = await prisma.segment.findMany({ where: { workspaceId: lead.workspaceId } });

  for (const segment of segments) {
    const matches = leadMatchesRules(lead, segment.rules);
    if (matches) {
      await prisma.segmentMembership.upsert({
        where: { segmentId_leadId: { segmentId: segment.id, leadId } },
        create: { segmentId: segment.id, leadId },
        update: {}
      });
    } else {
      await prisma.segmentMembership
        .delete({ where: { segmentId_leadId: { segmentId: segment.id, leadId } } })
        .catch(() => undefined);
    }
  }
}
