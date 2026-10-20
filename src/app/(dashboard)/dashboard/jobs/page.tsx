import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { Card, PageHeader } from "@/components/ui";
import { JobTable } from "@/components/jobs/job-table";

export const metadata = { title: "Job log" };

const STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "RETRYING", "CANCELLED"];

export default async function JobsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const { workspace } = await requireDashboardSession();

  const jobs = await prisma.jobLog.findMany({
    where: {
      workspaceId: workspace.id,
      ...(status ? { status: status as never } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <div>
      <PageHeader
        title="Job log"
        description="Monitora pubblicazioni social, email e workflow eseguiti dai worker BullMQ."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/dashboard/jobs"
          className={`badge ${!status ? "bg-loop-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          Tutti
        </Link>
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={`/dashboard/jobs?status=${value}`}
            className={`badge ${status === value ? "bg-loop-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {value}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <JobTable
          jobs={jobs.map((job) => ({
            id: job.id,
            queue: job.queue,
            name: job.name,
            status: job.status,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            error: job.error,
            createdAt: job.createdAt.toISOString(),
            finishedAt: job.finishedAt?.toISOString() ?? null
          }))}
        />
      </Card>
    </div>
  );
}
