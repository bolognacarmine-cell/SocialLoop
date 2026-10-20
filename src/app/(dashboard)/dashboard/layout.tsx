import { Sidebar } from "@/components/dashboard/sidebar";
import { requireDashboardSession } from "@/lib/dashboard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, workspace, workspaces } = await requireDashboardSession();

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen md:block">
        <Sidebar
          workspaceName={workspace.name}
          workspaces={workspaces}
          activeWorkspaceId={workspace.id}
          userName={session.name}
        />
      </div>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
