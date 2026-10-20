import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { PostComposer } from "@/components/posts/post-composer";
import { PostList } from "@/components/posts/post-list";

export const metadata = { title: "Contenuti" };

export default async function PostsPage() {
  const { workspace } = await requireDashboardSession();

  const [accounts, campaigns, posts] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { workspaceId: workspace.id, status: "CONNECTED" },
      select: { id: true, platform: true, accountName: true }
    }),
    prisma.campaign.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.post.findMany({
      where: { workspaceId: workspace.id },
      include: {
        targets: {
          include: { socialAccount: { select: { accountName: true } } }
        },
        campaign: { select: { name: true } }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50
    })
  ]);

  const rows = posts.map((post) => ({
    id: post.id,
    body: post.body,
    status: post.status,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    campaignName: post.campaign?.name ?? null,
    targets: post.targets.map((target) => ({
      id: target.id,
      platform: target.platform,
      status: target.status,
      accountName: target.socialAccount.accountName,
      error: target.error
    }))
  }));

  return (
    <div>
      <PageHeader
        title="Contenuti"
        description="Componi una volta e distribuisci su Instagram, Facebook, LinkedIn, X, TikTok e YouTube con adapter modulari."
        action={
          <Link href="/dashboard/calendar" className="btn-secondary">
            <CalendarDays className="h-4 w-4" /> Calendario editoriale
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <PostComposer accounts={accounts} campaigns={campaigns} />
        </div>
        <div className="xl:col-span-3">
          <Card>
            <CardHeader
              title="Libreria contenuti"
              description={`${rows.length} contenuti recenti`}
            />
            {rows.length === 0 ? (
              <div className="card-pad">
                <EmptyState
                  title="Nessun contenuto"
                  description="Crea il tuo primo post e collegalo a una landing page per avviare il funnel."
                />
              </div>
            ) : (
              <PostList posts={rows} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
