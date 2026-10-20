import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ChannelsManager } from "@/components/settings/channels-manager";
import { SUPPORTED_PLATFORMS } from "@/lib/social/registry";
import { formatDate, humanizeEnum } from "@/lib/utils";

export const metadata = { title: "Canali" };

export default async function SettingsPage() {
  const { workspace } = await requireDashboardSession();
  const mockEnabled = (process.env.MOCK_SOCIAL ?? "true") !== "false";

  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" }
  });

  return (
    <div>
      <PageHeader
        title="Canali & impostazioni"
        description="Collega i social network usati dagli adapter di pubblicazione."
      />

      <ChannelsManager
        mockEnabled={mockEnabled}
        platforms={SUPPORTED_PLATFORMS}
        accounts={accounts.map((account) => ({
          id: account.id,
          platform: account.platform,
          accountName: account.accountName,
          status: account.status,
          tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
          lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null
        }))}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Workspace" />
          <div className="card-pad space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Nome</span>
              <span className="font-medium text-slate-900">{workspace.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Slug</span>
              <span className="font-mono text-xs text-slate-700">{workspace.slug}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Piano</span>
              <span className="font-medium text-slate-900">{humanizeEnum(workspace.plan)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Creato</span>
              <span className="text-slate-700">{formatDate(workspace.createdAt)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Webhook" description="Endpoint per ricevere eventi esterni." />
          <div className="card-pad space-y-3 text-sm">
            <div>
              <p className="label">Social</p>
              <code className="block truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                /api/webhooks/social/[platform]
              </code>
            </div>
            <div>
              <p className="label">Email</p>
              <code className="block truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                /api/webhooks/email
              </code>
            </div>
            <p className="text-xs text-slate-500">
              Configura i provider per notificare consegne, aperture e click.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
