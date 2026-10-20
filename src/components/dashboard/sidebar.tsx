"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  KanbanSquare,
  LayoutGrid,
  ListChecks,
  LogOut,
  Megaphone,
  Plug,
  Workflow,
  Users,
  Send
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Panoramica", icon: LayoutGrid },
  { href: "/dashboard/posts", label: "Contenuti", icon: Send },
  { href: "/dashboard/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/dashboard/landing-pages", label: "Landing page", icon: Megaphone },
  { href: "/dashboard/leads", label: "CRM & Lead", icon: Users },
  { href: "/dashboard/workflows", label: "Automazioni", icon: Workflow },
  { href: "/dashboard/campaigns", label: "Campagne", icon: KanbanSquare },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/jobs", label: "Job log", icon: ListChecks },
  { href: "/dashboard/settings", label: "Canali", icon: Plug }
];

export function Sidebar({
  workspaceName,
  workspaces,
  activeWorkspaceId,
  userName
}: {
  workspaceName: string;
  workspaces: Array<{ id: string; name: string }>;
  activeWorkspaceId: string;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function switchWorkspace(id: string) {
    if (id === activeWorkspaceId) return;
    setSwitching(true);
    await fetch(`/api/workspaces/${id}/activate`, { method: "POST" });
    setSwitching(false);
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-loop-600 text-sm font-black text-white">
          SL
        </span>
        <div>
          <p className="text-sm font-bold leading-none text-slate-900">SocialLoop</p>
          <p className="mt-1 text-xs text-slate-500">Growth OS</p>
        </div>
      </div>

      <div className="border-b border-slate-100 px-3 py-3">
        {workspaces.length > 1 ? (
          <select
            className="input"
            value={activeWorkspaceId}
            disabled={switching}
            onChange={(event) => void switchWorkspace(event.target.value)}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="truncate px-2 text-sm font-semibold text-slate-700">{workspaceName}</p>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-loop-50 text-loop-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 truncate px-2 text-sm font-medium text-slate-700">{userName}</div>
        <button onClick={() => void logout()} className="btn-ghost w-full justify-start">
          <LogOut className="h-4 w-4" />
          Esci
        </button>
      </div>
    </aside>
  );
}
