import { PrismaClient, type SocialPlatform } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { encryptToken } from "../src/lib/crypto/tokens";
import { slugify } from "../src/lib/utils";
import { env } from "../src/lib/env";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword(env.SEED_DEMO_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: env.SEED_DEMO_EMAIL },
    update: { name: env.SEED_DEMO_NAME, passwordHash },
    create: {
      email: env.SEED_DEMO_EMAIL,
      name: env.SEED_DEMO_NAME,
      passwordHash
    }
  });

  const workspaceSlug = slugify(env.SEED_DEMO_WORKSPACE) || "socialloop-demo";
  const workspace = await prisma.workspace.upsert({
    where: { slug: workspaceSlug },
    update: { name: env.SEED_DEMO_WORKSPACE },
    create: {
      name: env.SEED_DEMO_WORKSPACE,
      slug: workspaceSlug,
      plan: "PRO",
      ownerId: user.id
    }
  });

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, workspaceId: workspace.id, role: "OWNER" }
  });

  const tagDefs = [
    { name: "hot-lead", color: "#f43f5e" },
    { name: "newsletter", color: "#338fff" },
    { name: "webinar", color: "#8b5cf6" }
  ];
  const tags = [];
  for (const def of tagDefs) {
    tags.push(
      await prisma.tag.upsert({
        where: { workspaceId_name: { workspaceId: workspace.id, name: def.name } },
        update: { color: def.color },
        create: { workspaceId: workspace.id, name: def.name, color: def.color }
      })
    );
  }

  const campaign = await ensureCampaign(workspace.id);

  const templates = [
    {
      name: "Benvenuto",
      subject: "Ecco la tua guida gratuita 🎉",
      html: "<h1>Benvenuto!</h1><p>Grazie per esserti iscritto. Trovi la guida in allegato.</p>"
    },
    {
      name: "Nurture day 3",
      subject: "Come trasformare i follower in clienti",
      html: "<h1>Il funnel in 3 passi</h1><p>Contenuto, landing page, automazione. Tutto qui.</p>"
    },
    {
      name: "Offerta finale",
      subject: "Ultime 24 ore per lo sconto",
      html: "<h1>Non perdere l'offerta</h1><p>Sconto valido fino a mezzanotte.</p>"
    }
  ];
  for (const template of templates) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { workspaceId: workspace.id, name: template.name }
    });
    if (!existing) {
      await prisma.emailTemplate.create({
        data: { workspaceId: workspace.id, ...template }
      });
    }
  }

  const landingPage = await ensureLandingPage(workspace.id);

  await ensureSocialAccount(workspace.id, "INSTAGRAM", "@socialloop");
  await ensureSocialAccount(workspace.id, "LINKEDIN", "SocialLoop");

  const leads = [
    { email: "giulia@brightco.io", name: "Giulia Bianchi", company: "BrightCo", stage: "QUALIFIED" as const, score: 72 },
    { email: "marco@nordic.dev", name: "Marco Rossi", company: "Nordic Dev", stage: "CONTACTED" as const, score: 48 },
    { email: "elena@studiozen.it", name: "Elena Conti", company: "Studio Zen", stage: "NURTURING" as const, score: 35 },
    { email: "luca@funnelup.com", name: "Luca Verdi", company: "FunnelUp", stage: "WON" as const, score: 95 },
    { email: "sara@shopwave.io", name: "Sara Neri", company: "ShopWave", stage: "NEW" as const, score: 20 }
  ];

  const createdLeads = [];
  for (const lead of leads) {
    createdLeads.push(
      await prisma.lead.upsert({
        where: { workspaceId_email: { workspaceId: workspace.id, email: lead.email } },
        update: { stage: lead.stage, score: lead.score },
        create: {
          workspaceId: workspace.id,
          email: lead.email,
          name: lead.name,
          company: lead.company,
          stage: lead.stage,
          score: lead.score,
          source: "LANDING_PAGE",
          campaignId: campaign.id,
          landingPageId: landingPage.id,
          consent: true,
          utm: { source: "instagram", medium: "social", campaign: campaign.utmCampaign },
          lastActivityAt: new Date()
        }
      })
    );
  }

  await prisma.leadTag.upsert({
    where: { leadId_tagId: { leadId: createdLeads[0].id, tagId: tags[0].id } },
    update: {},
    create: { leadId: createdLeads[0].id, tagId: tags[0].id }
  });

  const wonLead = createdLeads.find((lead) => lead.email === "luca@funnelup.com")!;

  const offerExisting = await prisma.offer.findFirst({
    where: { workspaceId: workspace.id, name: "SocialLoop Pro Annuale" }
  });
  const offer =
    offerExisting ??
    (await prisma.offer.create({
      data: {
        workspaceId: workspace.id,
        campaignId: campaign.id,
        name: "SocialLoop Pro Annuale",
        description: "Piano Pro con automazioni illimitate",
        priceCents: 49000,
        currency: "EUR",
        active: true
      }
    }));

  const conversionExisting = await prisma.conversion.findFirst({
    where: { workspaceId: workspace.id, leadId: wonLead.id, offerId: offer.id }
  });
  if (!conversionExisting) {
    await prisma.conversion.create({
      data: {
        workspaceId: workspace.id,
        leadId: wonLead.id,
        offerId: offer.id,
        campaignId: campaign.id,
        valueCents: 49000,
        currency: "EUR",
        metadata: { source: "seed" }
      }
    });
  }

  const segmentExisting = await prisma.segment.findFirst({
    where: { workspaceId: workspace.id, name: "Lead caldi" }
  });
  if (!segmentExisting) {
    await prisma.segment.create({
      data: {
        workspaceId: workspace.id,
        name: "Lead caldi",
        description: "Score sopra 60 e fase qualificata",
        rules: { match: "all", rules: [{ field: "score", operator: "greater_or_equal", value: 60 }] }
      }
    });
  }

  const workflowExisting = await prisma.workflow.findFirst({
    where: { workspaceId: workspace.id, name: "Benvenuto nuovo lead" }
  });
  if (!workflowExisting) {
    const template = await prisma.emailTemplate.findFirst({
      where: { workspaceId: workspace.id, name: "Benvenuto" }
    });
    await prisma.workflow.create({
      data: {
        workspaceId: workspace.id,
        name: "Benvenuto nuovo lead",
        description: "Invia email di benvenuto e assegna un tag dopo 1 giorno",
        status: "ACTIVE",
        triggerType: "LEAD_CREATED",
        triggerConfig: { match: "all", rules: [] },
        steps: [
          { id: "step-1", type: "action", action: { type: "send_email", templateId: template?.id } },
          {
            id: "step-2",
            type: "condition",
            condition: {
              match: "all",
              rules: [{ field: "score", operator: "greater_or_equal", value: 50 }]
            }
          },
          { id: "step-3", type: "action", action: { type: "add_tag", tagName: "hot-lead" } },
          { id: "step-4", type: "delay", delay: { amount: 1, unit: "days" } },
          { id: "step-5", type: "action", action: { type: "update_score", amount: 5, reason: "Nurture" } }
        ],
        createdById: user.id
      }
    });
  }

  await seedContent(workspace.id, campaign.id, user.id);
  await seedAnalytics(workspace.id, createdLeads.map((lead) => lead.id), campaign.id, landingPage.id);

  console.log("✅ Seed completato");
  console.log(`   Login: ${env.SEED_DEMO_EMAIL} / ${env.SEED_DEMO_PASSWORD}`);
  console.log(`   Workspace: ${workspace.name} (${workspace.slug})`);
}

async function ensureCampaign(workspaceId: string) {
  const existing = await prisma.campaign.findFirst({
    where: { workspaceId, name: "Lancio guida gratuita" }
  });
  if (existing) return existing;
  return prisma.campaign.create({
    data: {
      workspaceId,
      name: "Lancio guida gratuita",
      description: "Funnel lead magnet per raccogliere contatti qualificati",
      status: "ACTIVE",
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: "guida-gratuita"
    }
  });
}

async function ensureLandingPage(workspaceId: string) {
  const slug = "guida-gratuita";
  const existing = await prisma.landingPage.findUnique({ where: { slug } });
  if (existing) return existing;

  return prisma.landingPage.create({
    data: {
      workspaceId,
      name: "Guida gratuita al funnel social",
      slug,
      published: true,
      publishedAt: new Date(),
      headline: "Trasforma i follower in clienti con un funnel in 5 passi",
      seoTitle: "Guida gratuita: funnel social che converte",
      seoDescription: "Scarica la guida e costruisci il tuo funnel social in una settimana.",
      theme: { primary: "#338fff" },
      blocks: [
        {
          id: "hero-1",
          type: "hero",
          title: "Trasforma i follower in clienti",
          text: "La guida pratica per costruire contenuti, landing page e automazioni che vendono.",
          ctaLabel: "Scarica la guida",
          ctaUrl: "#lead-form",
          align: "center"
        },
        {
          id: "features-1",
          type: "features",
          title: "Cosa troverai nella guida",
          items: [
            "Il funnel in 5 passi",
            "Template di contenuti pronti",
            "Checklist di automazioni"
          ]
        },
        {
          id: "form-1",
          type: "form",
          title: "Ricevi la guida via email",
          text: "Ti invieremo la guida e una mini-serie di 3 email.",
          align: "center"
        }
      ],
      form: {
        create: {
          workspaceId,
          name: "Guida gratuita lead form",
          fields: [
            { name: "email", label: "Email", type: "email", required: true },
            { name: "name", label: "Nome", type: "text", required: false },
            { name: "company", label: "Azienda", type: "text", required: false }
          ],
          submitLabel: "Invia la guida",
          successMessage: "Fatto! Controlla la tua inbox tra pochi secondi."
        }
      }
    }
  });
}

async function ensureSocialAccount(workspaceId: string, platform: SocialPlatform, accountName: string) {
  const externalId = `mock-${platform.toLowerCase()}`;
  return prisma.socialAccount.upsert({
    where: { workspaceId_platform_externalId: { workspaceId, platform, externalId } },
    update: { status: "CONNECTED", lastSyncedAt: new Date() },
    create: {
      workspaceId,
      platform,
      accountName,
      externalId,
      accessToken: encryptToken(`mock-access-${platform.toLowerCase()}`),
      refreshToken: encryptToken(`mock-refresh-${platform.toLowerCase()}`),
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      scopes: ["publish", "read_insights"],
      status: "CONNECTED",
      lastSyncedAt: new Date()
    }
  });
}

async function seedContent(workspaceId: string, campaignId: string, authorId: string) {
  const existing = await prisma.post.findFirst({
    where: { workspaceId, campaignId }
  });
  if (existing) return;

  const accounts = await prisma.socialAccount.findMany({ where: { workspaceId } });

  const published = await prisma.post.create({
    data: {
      workspaceId,
      campaignId,
      authorId,
      body: "Stai pubblicando ogni giorno ma i lead non arrivano? Il problema non è la frequenza, è il funnel. Scarica la guida gratuita 👇",
      linkUrl: `${env.NEXT_PUBLIC_APP_URL}/l/guida-gratuita`,
      status: "PUBLISHED",
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      targets: {
        create: accounts.map((account) => ({
          socialAccountId: account.id,
          platform: account.platform,
          status: "PUBLISHED" as const,
          remotePostId: `mock-${account.platform.toLowerCase()}-1`,
          publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2)
        }))
      }
    }
  });

  await prisma.post.create({
    data: {
      workspaceId,
      campaignId,
      authorId,
      body: "Domani webinar gratuito: come costruire il funnel social che converte. Iscriviti dal link in bio.",
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      targets: {
        create: accounts.map((account) => ({
          socialAccountId: account.id,
          platform: account.platform,
          status: "PENDING" as const
        }))
      }
    }
  });

  await prisma.post.create({
    data: {
      workspaceId,
      campaignId,
      authorId,
      body: "Bozza: 5 errori da evitare nel calendario editoriale dei social.",
      status: "DRAFT"
    }
  });

  void published;
}

async function seedAnalytics(
  workspaceId: string,
  leadIds: string[],
  campaignId: string,
  landingPageId: string
) {
  const existing = await prisma.analyticsEvent.count({ where: { workspaceId } });
  if (existing > 0) return;

  const events = [];
  for (let day = 29; day >= 0; day -= 1) {
    const occurredAt = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
    const views = 6 + Math.round(Math.random() * 10);
    for (let index = 0; index < views; index += 1) {
      events.push({
        workspaceId,
        type: "PAGE_VIEW" as const,
        name: "Landing view",
        landingPageId,
        campaignId,
        occurredAt
      });
    }
  }
  await prisma.analyticsEvent.createMany({ data: events });

  await prisma.analyticsEvent.createMany({
    data: leadIds.map((leadId) => ({
      workspaceId,
      type: "LEAD_CREATED" as const,
      name: "Lead created",
      leadId,
      campaignId,
      landingPageId
    }))
  });

  await prisma.analyticsEvent.create({
    data: {
      workspaceId,
      type: "CONVERSION",
      name: "Offerta annuale",
      campaignId,
      value: 490,
      currency: "EUR"
    }
  });

  const jobSamples = [
    { queue: "social-publish", name: "publish-post", status: "COMPLETED" as const },
    { queue: "workflow", name: "run-workflow", status: "COMPLETED" as const },
    { queue: "email", name: "send-email", status: "FAILED" as const, error: "SMTP timeout" }
  ];
  for (const sample of jobSamples) {
    await prisma.jobLog.create({
      data: {
        workspaceId,
        queue: sample.queue,
        name: sample.name,
        status: sample.status,
        attempts: sample.status === "FAILED" ? 3 : 1,
        maxAttempts: 3,
        error: sample.error ?? null,
        finishedAt: new Date()
      }
    });
  }
}

main()
  .catch((error) => {
    console.error("❌ Seed fallito", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
