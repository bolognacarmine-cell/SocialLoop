import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { CreateWorkflow } from "@/components/workflows/create-workflow";
import { asArray, humanizeEnum } from "@/lib/utils";

export const metadata = { title: "Automazioni" };

export default async function WorkflowsPage() {
  const { workspace } = await requireDashboardSession();

  const workflows = await prisma.workflow.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: { select: { runs: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <PageHeader
        title="Automazioni"
        description="Workflow trigger → condizione → attesa → azione per nutrire e convertire i lead."
        action={<CreateWorkflow />}
      />

      {workflows.length === 0 ? (
        <EmptyState
          title="Nessuna automazione"
          description="Crea il tuo primo workflow: ad esempio invia una email di benvenuto quando arriva un nuovo lead."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader
                title={workflow.name}
                description={humanizeEnum(workflow.triggerType)}
                action={
                  <span
                    className={`badge ${
                      workflow.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700"
                        : workflow.status === "PAUSED"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {humanizeEnum(workflow.status)}
                  </span>
                }
              />
              <div className="card-pad">
                <p className="text-sm text-slate-600">
                  {workflow.description ?? "Nessuna descrizione."}
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span>{asArray(workflow.steps).length} passi</span>
                  <span>{workflow._count.runs} esecuzioni</span>
                </div>
                <Link
                  href={`/dashboard/workflows/${workflow.id}`}
                  className="btn-secondary mt-4 !px-3 !py-1.5 text-xs"
                >
                  Modifica
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
