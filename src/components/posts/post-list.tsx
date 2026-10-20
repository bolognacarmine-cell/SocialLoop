"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_META } from "@/lib/social/platforms";
import type { SocialPlatform } from "@prisma/client";
import { formatDate, humanizeEnum, truncate } from "@/lib/utils";

type PostRow = {
  id: string;
  body: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  campaignName: string | null;
  targets: Array<{
    id: string;
    platform: SocialPlatform;
    status: string;
    accountName: string;
    error: string | null;
  }>;
};

const statusTones: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SCHEDULED: "bg-amber-100 text-amber-700",
  PUBLISHING: "bg-loop-100 text-loop-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-violet-100 text-violet-700",
  FAILED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-500"
};

export function PostList({ posts }: { posts: PostRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function action(postId: string, path: string) {
    setBusy(postId);
    setError(null);
    const response = await fetch(`/api/posts/${postId}${path}`, { method: "POST" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Azione non riuscita");
    }
    setBusy(null);
    router.refresh();
  }

  async function remove(postId: string) {
    if (!confirm("Eliminare questo contenuto?")) return;
    setBusy(postId);
    await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      <div className="divide-y divide-slate-100">
        {posts.map((post) => (
          <div key={post.id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">{truncate(post.body, 220)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {post.targets.map((target) => {
                    const meta = PLATFORM_META[target.platform];
                    return (
                      <span
                        key={target.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1"
                        title={target.error ?? target.status}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        {target.accountName}
                        <span className="text-slate-400">{humanizeEnum(target.status)}</span>
                      </span>
                    );
                  })}
                  {post.campaignName ? <span>· {post.campaignName}</span> : null}
                  {post.scheduledAt ? <span>· {formatDate(post.scheduledAt, true)}</span> : null}
                  {post.publishedAt ? <span>· pubblicato {formatDate(post.publishedAt, true)}</span> : null}
                </div>
              </div>
              <span className={`badge ${statusTones[post.status] ?? statusTones.DRAFT}`}>
                {humanizeEnum(post.status)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {["DRAFT", "SCHEDULED", "CANCELLED", "FAILED", "PARTIAL"].includes(post.status) ? (
                <button
                  type="button"
                  disabled={busy === post.id}
                  onClick={() => void action(post.id, "/publish")}
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                >
                  Pubblica ora
                </button>
              ) : null}
              {["FAILED", "PARTIAL"].includes(post.status) ? (
                <button
                  type="button"
                  disabled={busy === post.id}
                  onClick={() => void action(post.id, "/retry")}
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                >
                  Riprova
                </button>
              ) : null}
              {["DRAFT", "SCHEDULED"].includes(post.status) ? (
                <button
                  type="button"
                  disabled={busy === post.id}
                  onClick={() => void action(post.id, "/cancel")}
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                >
                  Annulla
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy === post.id}
                onClick={() => void remove(post.id)}
                className="btn-ghost !px-3 !py-1.5 text-xs text-rose-600"
              >
                Elimina
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
