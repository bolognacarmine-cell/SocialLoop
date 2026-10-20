import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { CreateCampaign } from "@/components/campaigns/create-campaign";
import { formatCurrency, humanizeEnum } from "@/lib/utils";

export const metadata = { title: "Campagne" };

export default async function CampaignsPage() {
  const { workspace } = await requireDashboardSession();

  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: { select: { posts: true, leads: true, conversions: true } },
      conversions: { select: { valueCents: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <PageHeader
        title="Campagne"
        description="Raggruppa contenuti, landing page e lead per misurare il ROI di ogni iniziativa."
        action={<CreateCampaign />}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title="Nessuna campagna"
          description="Crea una campagna per attribuire lead e conversioni ai contenuti giusti."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => {
            const revenue = campaign.conversions.reduce(
              (sum, conversion) => sum + conversion.valueCents,
              0
            );
            return (
              <Card key={campaign.id}>
                <CardHeader
                  title={campaign.name}
                  description={campaign.utmCampaign ? `utm: ${campaign.utmCampaign}` : undefined}
                  action={<span className="badge bg-loop-100 text-loop-700">{humanizeEnum(campaign.status)}</span>}
                />
                <div className="card-pad">
                  <p className="min-h-[40px] text-sm text-slate-600">
                    {campaign.description ?? "Nessuna descrizione."}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
                    <div className="rounded-xl bg-slate-50 py-3">
                      <p className="text-lg font-bold text-slate-900">{campaign._count.posts}</p>
                      <p className="text-xs text-slate-500">Post</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 py-3">
                      <p className="text-lg font-bold text-slate-900">{campaign._count.leads}</p>
                      <p className="text-xs text-slate-500">Lead</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 py-3">
                      <p className="text-lg font-bold text-slate-900">{campaign._count.conversions}</p>
                      <p className="text-xs text-slate-500">Conversioni</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 py-3">
                      <p className="text-lg font-bold text-slate-900">{formatCurrency(revenue)}</p>
                      <p className="text-xs text-slate-500">Ricavi</p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
