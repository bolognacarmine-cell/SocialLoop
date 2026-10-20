import type { AnalyticsEventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type TrackEventInput = {
  workspaceId: string;
  type: AnalyticsEventType;
  name: string;
  leadId?: string | null;
  campaignId?: string | null;
  socialPostId?: string | null;
  landingPageId?: string | null;
  offerId?: string | null;
  value?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

export async function trackEvent(input: TrackEventInput) {
  return prisma.analyticsEvent.create({
    data: {
      workspaceId: input.workspaceId,
      type: input.type,
      name: input.name,
      leadId: input.leadId ?? null,
      campaignId: input.campaignId ?? null,
      socialPostId: input.socialPostId ?? null,
      landingPageId: input.landingPageId ?? null,
      offerId: input.offerId ?? null,
      value: input.value ?? null,
      currency: input.currency ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      occurredAt: input.occurredAt ?? new Date()
    }
  });
}

export type OverviewRange = 7 | 30 | 90;

export async function getWorkspaceOverview(workspaceId: string, days: OverviewRange = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    leads,
    newLeads,
    conversions,
    publishedPosts,
    emailsSent,
    emailOpens,
    emailClicks,
    campaigns,
    events,
    stageGroups,
    recentLeads
  ] = await Promise.all([
    prisma.lead.count({ where: { workspaceId } }),
    prisma.lead.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.conversion.findMany({
      where: { workspaceId, occurredAt: { gte: since } },
      select: { valueCents: true, currency: true }
    }),
    prisma.post.count({
      where: { workspaceId, status: "PUBLISHED", publishedAt: { gte: since } }
    }),
    prisma.emailSend.count({
      where: { workspaceId, sentAt: { gte: since }, status: { not: "FAILED" } }
    }),
    prisma.emailSend.count({ where: { workspaceId, openedAt: { gte: since } } }),
    prisma.emailSend.count({ where: { workspaceId, clickedAt: { gte: since } } }),
    prisma.campaign.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { leads: true, posts: true, conversions: true } },
        conversions: { select: { valueCents: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.analyticsEvent.groupBy({
      by: ["type"],
      where: { workspaceId, occurredAt: { gte: since } },
      _count: { _all: true }
    }),
    prisma.lead.groupBy({
      by: ["stage"],
      where: { workspaceId },
      _count: { _all: true }
    }),
    prisma.lead.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { campaign: { select: { name: true } } }
    })
  ]);

  const revenueCents = conversions.reduce((sum, conversion) => sum + conversion.valueCents, 0);
  const conversionCount = conversions.length;
  const eventCounts = Object.fromEntries(events.map((event) => [event.type, event._count._all]));

  const dailyLeads = await prisma.lead.findMany({
    where: { workspaceId, createdAt: { gte: since } },
    select: { createdAt: true }
  });
  const dailyConversions = await prisma.conversion.findMany({
    where: { workspaceId, occurredAt: { gte: since } },
    select: { occurredAt: true, valueCents: true }
  });

  const series: Array<{ date: string; leads: number; conversions: number; revenueCents: number }> = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    series.push({
      date: key,
      leads: dailyLeads.filter((lead) => lead.createdAt.toISOString().slice(0, 10) === key).length,
      conversions: dailyConversions.filter(
        (conversion) => conversion.occurredAt.toISOString().slice(0, 10) === key
      ).length,
      revenueCents: dailyConversions
        .filter((conversion) => conversion.occurredAt.toISOString().slice(0, 10) === key)
        .reduce((sum, conversion) => sum + conversion.valueCents, 0)
    });
  }

  return {
    totals: {
      leads,
      newLeads,
      conversions: conversionCount,
      revenueCents,
      publishedPosts,
      emailsSent,
      emailOpens,
      emailClicks,
      leadConversionRate: leads ? Math.round((conversionCount / leads) * 1000) / 10 : 0,
      openRate: emailsSent ? Math.round((emailOpens / emailsSent) * 1000) / 10 : 0,
      clickRate: emailsSent ? Math.round((emailClicks / emailsSent) * 1000) / 10 : 0
    },
    eventCounts,
    stages: stageGroups.map((group) => ({ stage: group.stage, count: group._count._all })),
    campaignPerformance: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      leads: campaign._count.leads,
      posts: campaign._count.posts,
      conversions: campaign._count.conversions,
      revenueCents: campaign.conversions.reduce((sum, conversion) => sum + conversion.valueCents, 0)
    })),
    recentLeads,
    series
  };
}
