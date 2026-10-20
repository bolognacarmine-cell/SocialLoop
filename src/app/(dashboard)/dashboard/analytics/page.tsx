import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { getWorkspaceOverview } from "@/lib/analytics";
import { BarSeries, FunnelSteps } from "@/components/charts";
import { Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { formatCurrency, humanizeEnum, percent } from "@/lib/utils";

export const metadata = { title: "Analytics" };

const RANGES = [7, 30, 90] as const;

export default async function AnalyticsPage({
  searchParams
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = RANGES.includes(Number(daysParam) as (typeof RANGES)[number])
    ? (Number(daysParam) as 7 | 30 | 90)
    : 30;

  const { workspace } = await requireDashboardSession();
  const overview = await getWorkspaceOverview(workspace.id, days);

  const [topPosts, accountBreakdown] = await Promise.all([
    prisma.post.findMany({
      where: { workspaceId: workspace.id, status: "PUBLISHED" },
      include: { targets: { select: { platform: true } } },
      orderBy: { publishedAt: "desc" },
      take: 5
    }),
    prisma.postTarget.groupBy({
      by: ["platform", "status"],
      where: { post: { workspaceId: workspace.id } },
      _count: { _all: true }
    })
  ]);

  const publishedCount = accountBreakdown
    .filter((row) => row.status === "PUBLISHED")
    .reduce((sum, row) => sum + row._count._all, 0);
  const failedCount = accountBreakdown
    .filter((row) => row.status === "FAILED")
    .reduce((sum, row) => sum + row._count._all, 0);
  const totalTargets = accountBreakdown.reduce((sum, row) => sum + row._count._all, 0);

  const pageViews = overview.eventCounts.PAGE_VIEW ?? 0;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Funnel, contenuti e canali in un unico posto."
        action={
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {RANGES.map((range) => (
              <Link
                key={range}
                href={`/dashboard/analytics?days=${range}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  range === days ? "bg-loop-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {range}g
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Lead" value={overview.totals.leads} hint={`${overview.totals.newLeads} nuovi nel periodo`} />
        <Stat label="Conversioni" value={overview.totals.conversions} hint={`${overview.totals.leadConversionRate}% dei lead`} />
        <Stat label="Ricavi" value={formatCurrency(overview.totals.revenueCents)} hint="Valore conversioni" />
        <Stat
          label="Email"
          value={overview.totals.emailsSent}
          hint={`Open ${overview.totals.openRate}% · Click ${overview.totals.clickRate}%`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`Andamento lead (${days} giorni)`} />
          <div className="card-pad">
            <BarSeries
              data={overview.series.map((point) => ({
                label: point.date.slice(5),
                value: point.leads,
                hint: `${point.conversions} conversioni`
              }))}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Funnel conversioni" />
          <div className="card-pad">
            <FunnelSteps
              steps={[
                { label: "Visite landing", value: pageViews },
                { label: "Lead", value: overview.totals.leads },
                { label: "Email", value: overview.totals.emailsSent },
                { label: "Conversioni", value: overview.totals.conversions }
              ]}
            />
            {pageViews > 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                Tasso di cattura: {percent(overview.totals.leads, pageViews)}%
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Performance campagne" description="ROI per iniziativa." />
          {overview.campaignPerformance.length === 0 ? (
            <div className="card-pad">
              <EmptyState title="Nessuna campagna" description="Crea campagne per vedere le metriche." />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">Campagna</th>
                  <th className="table-th">Lead</th>
                  <th className="table-th">Conv.</th>
                  <th className="table-th">Ricavi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.campaignPerformance.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="table-td font-medium text-slate-900">{campaign.name}</td>
                    <td className="table-td">{campaign.leads}</td>
                    <td className="table-td">{campaign.conversions}</td>
                    <td className="table-td">{formatCurrency(campaign.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Pubblicazioni" description="Esito dei target social." />
            <div className="card-pad space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Successi</span>
                <span className="font-semibold text-emerald-700">{publishedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Errori</span>
                <span className="font-semibold text-rose-700">{failedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Success rate</span>
                <span className="font-semibold text-slate-900">
                  {percent(publishedCount, totalTargets)}%
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Eventi funnel" />
            <div className="card-pad space-y-2 text-sm">
              {Object.keys(overview.eventCounts).length === 0 ? (
                <p className="text-slate-500">Nessun evento registrato.</p>
              ) : (
                Object.entries(overview.eventCounts).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-slate-500">{humanizeEnum(type)}</span>
                    <span className="font-semibold text-slate-900">{count}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Ultimi post pubblicati" />
        {topPosts.length === 0 ? (
          <div className="card-pad">
            <EmptyState title="Nessun post pubblicato" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {topPosts.map((post) => (
              <div key={post.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <p className="min-w-0 flex-1 truncate text-sm text-slate-700">{post.body}</p>
                <div className="flex gap-1">
                  {post.targets.map((target, index) => (
                    <span key={index} className="badge bg-slate-100 text-slate-600">
                      {humanizeEnum(target.platform)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
