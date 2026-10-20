import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { PageHeader } from "@/components/ui";
import { LeadCrm, type LeadListItem } from "@/components/leads/lead-crm";

export const metadata = { title: "CRM & Lead" };

export default async function LeadsPage() {
  const { workspace } = await requireDashboardSession();

  const [leads, segments] = await Promise.all([
    prisma.lead.findMany({
      where: { workspaceId: workspace.id },
      include: {
        tags: { include: { tag: true } },
        campaign: { select: { name: true } },
        _count: { select: { conversions: true, emailSends: true, submissions: true } }
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 200
    }),
    prisma.segment.findMany({
      where: { workspaceId: workspace.id },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const items: LeadListItem[] = leads.map((lead) => ({
    id: lead.id,
    email: lead.email,
    name: lead.name,
    company: lead.company,
    stage: lead.stage,
    source: lead.source,
    score: lead.score,
    createdAt: lead.createdAt.toISOString(),
    campaignName: lead.campaign?.name ?? null,
    tags: lead.tags.map(({ tag }) => ({ name: tag.name, color: tag.color })),
    conversions: lead._count.conversions,
    emails: lead._count.emailSends,
    submissions: lead._count.submissions
  }));

  return (
    <div>
      <PageHeader
        title="CRM & Lead"
        description="Gestisci lead, punteggi di engagement, tag e segmenti automatici."
      />
      <LeadCrm
        leads={items}
        segments={segments.map((segment) => ({
          id: segment.id,
          name: segment.name,
          count: segment._count.members
        }))}
      />
    </div>
  );
}
