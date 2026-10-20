import type { Lead } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SCORE_POINTS = {
  LEAD_CREATED: 10,
  FORM_SUBMITTED: 15,
  EMAIL_OPEN: 3,
  EMAIL_CLICK: 8,
  PAGE_VIEW: 1,
  OFFER_VIEW: 5,
  CONVERSION: 50,
  PROFILE_COMPLETED: 10,
  COMPANY_EMAIL: 10
} as const;

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "libero.it",
  "virgilio.it",
  "tiscali.it"
]);

export type ScoreInput = {
  email: string;
  name?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  stage?: string;
  source?: string;
};

/**
 * Deterministic score used when a lead is created. Event-based points are added
 * later by applyLeadScore (form, email open/click, offer view, conversion).
 */
export function calculateInitialScore(lead: ScoreInput): number {
  let score = 0;
  score += SCORE_POINTS.LEAD_CREATED;

  if (lead.name?.trim()) score += 5;
  if (lead.phone?.trim()) score += 10;
  if (lead.company?.trim()) score += 8;
  if (lead.jobTitle?.trim()) score += 4;

  const domain = lead.email.split("@")[1]?.toLowerCase();
  if (domain && !FREE_EMAIL_DOMAINS.has(domain)) score += SCORE_POINTS.COMPANY_EMAIL;
  if (lead.source === "REFERRAL") score += 15;
  if (lead.source === "ORGANIC_SOCIAL") score += 5;

  if (lead.name && lead.company && lead.phone) score += SCORE_POINTS.PROFILE_COMPLETED;
  return clampScore(score);
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(1000, Math.round(score)));
}

export function scoreTier(score: number): "cold" | "warm" | "hot" {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export async function applyLeadScore(
  leadId: string,
  delta: number,
  reason: string,
  metadata: Record<string, unknown> = {}
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead non trovato");

  const nextScore = clampScore(lead.score + delta);
  const actualDelta = nextScore - lead.score;

  const [updated] = await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: { score: nextScore, lastActivityAt: new Date() }
    }),
    prisma.leadScoreEvent.create({
      data: { leadId, delta: actualDelta, reason, metadata: metadata as object }
    })
  ]);

  return updated;
}

export function isLead(row: Lead | null): row is Lead {
  return Boolean(row);
}
