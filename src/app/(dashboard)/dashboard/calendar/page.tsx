import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { EditorialCalendar } from "@/components/calendar/editorial-calendar";

export const metadata = { title: "Calendario" };

export default async function CalendarPage() {
  const { workspace } = await requireDashboardSession();

  const posts = await prisma.post.findMany({
    where: {
      workspaceId: workspace.id,
      status: "SCHEDULED",
      scheduledAt: { not: null }
    },
    include: { targets: { select: { platform: true } } },
    orderBy: { scheduledAt: "asc" }
  });

  const items = posts
    .filter((post) => post.scheduledAt)
    .map((post) => ({
      id: post.id,
      body: post.body,
      status: post.status,
      scheduledAt: post.scheduledAt!.toISOString(),
      platforms: post.targets.map((target) => target.platform)
    }));

  return (
    <div>
      <PageHeader
        title="Calendario editoriale"
        description="Visualizza e riprogramma i contenuti trascinando le card."
        action={
          <Link href="/dashboard/posts" className="btn-primary">
            <Plus className="h-4 w-4" /> Nuovo contenuto
          </Link>
        }
      />
      <Card>
        {items.length === 0 ? (
          <div className="card-pad">
            <EmptyState
              title="Nessun contenuto programmato"
              description="Programma un post per vederlo apparire nel calendario."
              action={
                <Link href="/dashboard/posts" className="btn-secondary">
                  Programma contenuto
                </Link>
              }
            />
          </div>
        ) : (
          <EditorialCalendar items={items} />
        )}
      </Card>
    </div>
  );
}
