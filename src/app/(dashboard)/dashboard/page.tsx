import Link from "next/link";
import { Activity, Coins, Mail, Sparkles, Target, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { getWorkspaceOverview } from "@/lib/analytics";
import { Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { BarSeries, FunnelSteps } from "@/components/charts";
import { formatCurrency, formatDate, humanizeEnum, percent, truncate } from "@/lib/utils";

export const metadata = { title: "Panoramica" };

export default async function DashboardPage() {
  const { workspace } = await requireDashboardSession();
  const overview = await getWorkspaceOverview(workspace.id, 30);

  const [accounts, activeWorkflows, scheduledPosts] = await Promise.all([
    prisma.socialAccount.count({ where: { workspaceId: workspace.id, status: "CONNECTED" } }),
    prisma.workflow.count({ where: { workspaceId: workspace.id, status: "ACTIVE" } }),
    prisma.post.count({ where: { workspaceId: workspace.id, status: "SCHEDULED" } })
  ]);

  const pageViews = overview.eventCounts.PAGE_VIEW ?? 0;

  return (
    <div>
      <PageHeader
        title={`Ciao, benvenuto in ${workspace.name}`}
        description="Il funnel completo: contenuti social → landing page → lead → nurture → offerta → conversione."
        action={
          <Link href="/dashboard/posts" className="btn-primary">
            <Sparkles className="h-4 w-4" /> Crea contenuto
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Lead (30g)"
          value={overview.totals.newLeads}
          hint={`${overview.totals.leads} totali in CRM`}
          icon={<Users className="h-4 w-4" />}
        />
        <Stat
          label="Conversioni"
          value={overview.totals.conversions}
          hint={`${formatCurrency(overview.totals.revenueCents)} di ricavi`}
          icon={<Target className="h-4 w-4" />}
        />
        <Stat
          label="Lead → cliente"
          value={`${overview.totals.leadConversionRate}%`}
          hint={`${overview.totals.publishedPosts} post pubblicati`}
          icon={<Coins className="h-4 w-4" />}
        />
        <Stat
          label="Email inviate"
          value={overview.totals.emailsSent}
          hint={`Open ${overview.totals.openRate}% · Click ${overview.totals.clickRate}%`}
          icon={<Mail className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Andamento lead (30 giorni)"
            description="Lead e conversioni registrate dal funnel."
          />
          <div className="card-pad">
            <BarSeries
              data={overview.series.map((point) => ({
                label: point.date.slice(5),
                value: point.leads,
                hint: `${point.conversions} conversioni`
              }))}
            />
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{overview.series[0]?.date}</span>
              <span>Lead nel periodo: {overview.totals.newLeads}</span>
              <span>{overview.series[overview.series.length - 1]?.date}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Funnel" description="Dal contenuto alla conversione." />
          <div className="card-pad">
            <FunnelSteps
              steps={[
                { label: "Visualizzazioni landing", value: pageViews },
                { label: "Lead in CRM", value: overview.totals.leads },
                { label: "Email inviate", value: overview.totals.emailsSent },
                { label: "Conversioni", value: overview.totals.conversions }
              ]}
            />
            {pageViews > 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                Form completion rate: {percent(overview.totals.leads, pageViews)}%
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Performance campagne"
            description="Contenuti, lead e ricavi per campagna."
            action={
              <Link href="/dashboard/campaigns" className="text-sm font-semibold text-loop-700">
                Gestisci
              </Link>
            }
          />
          {overview.campaignPerformance.length === 0 ? (
            <div className="card-pad">
              <EmptyState
                title="Nessuna campagna"
                description="Crea una campagna per tracciare contenuti, lead e conversioni."
                action={
                  <Link href="/dashboard/campaigns" className="btn-secondary">
                    Crea campagna
                  </Link>
                }
              />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-th">Campagna</th>
                  <th className="table-th">Post</th>
                  <th className="table-th">Lead</th>
                  <th className="table-th">Conv.</th>
                  <th className="table-th">Ricavi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.campaignPerformance.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="table-td font-medium text-slate-900">{campaign.name}</td>
                    <td className="table-td">{campaign.posts}</td>
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
            <CardHeader title="Stato del workspace" />
            <div className="card-pad space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Canali connessi</span>
                <Link href="/dashboard/settings" className="font-semibold text-loop-700">
                  {accounts}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Workflow attivi</span>
                <Link href="/dashboard/workflows" className="font-semibold text-loop-700">
                  {activeWorkflows}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Post programmati</span>
                <Link href="/dashboard/calendar" className="font-semibold text-loop-700">
                  {scheduledPosts}
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Ultimi lead" />
            <div className="divide-y divide-slate-100">
              {overview.recentLeads.length === 0 ? (
                <p className="card-pad text-sm text-slate-500">Nessun lead ancora.</p>
              ) : (
                overview.recentLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/dashboard/leads?lead=${lead.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {lead.name ?? lead.email}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {humanizeEnum(lead.stage)} · {formatDate(lead.createdAt)}
                      </p>
                    </div>
                    <span className="badge bg-loop-100 text-loop-700">{lead.score}</span>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Attività recenti"
          description="Eventi del funnel registrati nel periodo."
          action={<Activity className="h-4 w-4 text-slate-400" />}
        />
        <div className="card-pad grid gap-3 sm:grid-cols-3">
          {Object.keys(overview.eventCounts).length === 0 ? (
            <p className="text-sm text-slate-500">
              Nessun evento ancora. Pubblica un contenuto o ricevi un lead per popolare le analytics.
            </p>
          ) : (
            Object.entries(overview.eventCounts).map(([type, count]) => (
              <div key={type} className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {humanizeEnum(type)}
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">{count}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
