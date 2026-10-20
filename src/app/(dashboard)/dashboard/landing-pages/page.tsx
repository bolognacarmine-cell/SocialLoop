import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { CreateLandingPage } from "@/components/landing/create-form";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Landing page" };

export default async function LandingPagesPage() {
  const { workspace } = await requireDashboardSession();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const pages = await prisma.landingPage.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { leads: true } } },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <PageHeader
        title="Landing page"
        description="Pagine di cattura con form integrati, collegate ai contenuti social e al CRM."
        action={<CreateLandingPage />}
      />

      {pages.length === 0 ? (
        <EmptyState
          title="Nessuna landing page"
          description="Crea la tua prima pagina di cattura lead con builder a blocchi e form integrato."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pages.map((page) => (
            <Card key={page.id}>
              <CardHeader
                title={page.name}
                description={`/l/${page.slug}`}
                action={
                  <span
                    className={`badge ${
                      page.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {page.published ? "Pubblicata" : "Bozza"}
                  </span>
                }
              />
              <div className="card-pad">
                <p className="text-sm text-slate-600">
                  {page.headline ?? "Nessuna headline impostata."}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>{page._count.leads} lead</span>
                  <span>Aggiornata {formatDate(page.updatedAt)}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/dashboard/landing-pages/${page.id}`} className="btn-secondary !px-3 !py-1.5 text-xs">
                    Modifica
                  </Link>
                  <a
                    href={`${appUrl}/l/${page.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost !px-3 !py-1.5 text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Apri
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
