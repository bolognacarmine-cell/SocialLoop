import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { asArray, asRecord } from "@/lib/utils";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";

export const metadata = { title: "Editor automazione" };

export default async function WorkflowEditorPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspace } = await requireDashboardSession();

  const workflow = await prisma.workflow.findFirst({
    where: { id, workspaceId: workspace.id }
  });
  if (!workflow) notFound();

  const [templates, segments, accounts] = await Promise.all([
    prisma.emailTemplate.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true }
    }),
    prisma.segment.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true }
    }),
    prisma.socialAccount.findMany({
      where: { workspaceId: workspace.id, status: "CONNECTED" },
      select: { id: true, accountName: true }
    })
  ]);

  const triggerConfig = asRecord(workflow.triggerConfig);

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/workflows" className="btn-ghost !px-3 !py-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> Torna alle automazioni
        </Link>
      </div>
      <WorkflowEditor
        workflow={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          triggerType: workflow.triggerType,
          triggerConfig: {
            match: (triggerConfig.match as "all" | "any") ?? "all",
            rules: asArray(triggerConfig.rules),
            tag: (triggerConfig.tag as string) ?? undefined,
            stage: (triggerConfig.stage as string) ?? undefined,
            minScore: (triggerConfig.minScore as number) ?? undefined
          },
          steps: asArray(workflow.steps) as never
        }}
        templates={templates}
        segments={segments}
        accounts={accounts}
      />
    </div>
  );
}
