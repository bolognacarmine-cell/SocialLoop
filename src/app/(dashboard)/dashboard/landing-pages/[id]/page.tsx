import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireDashboardSession } from "@/lib/dashboard";
import { asArray } from "@/lib/utils";
import { LandingPageBuilder } from "@/components/landing/builder";
import type { LandingBlock } from "@/components/landing/render";

export const metadata = { title: "Builder landing page" };

export default async function LandingPageBuilderPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspace } = await requireDashboardSession();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const page = await prisma.landingPage.findFirst({
    where: { id, workspaceId: workspace.id }
  });
  if (!page) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard/landing-pages" className="btn-ghost !px-3 !py-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> Torna alle landing
        </Link>
      </div>
      <LandingPageBuilder
        appUrl={appUrl}
        page={{
          id: page.id,
          name: page.name,
          slug: page.slug,
          headline: page.headline,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          published: page.published,
          blocks: asArray<LandingBlock>(page.blocks)
        }}
      />
    </div>
  );
}
