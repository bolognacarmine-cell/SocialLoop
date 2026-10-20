import { NextResponse, type NextRequest } from "next/server";
import { SocialPlatform } from "@prisma/client";
import { requireWorkspace, withApi } from "@/lib/api";
import { createOAuthStart } from "@/lib/social/oauth";

type Context = { params: Promise<{ platform: string }> };

export const GET = withApi<Context>(async (_request: NextRequest, { params }) => {
  const { platform: rawPlatform } = await params;
  const platform = rawPlatform.toUpperCase() as SocialPlatform;
  if (!Object.values(SocialPlatform).includes(platform)) {
    return NextResponse.json({ error: "Piattaforma non supportata" }, { status: 400 });
  }

  const { session, workspace } = await requireWorkspace();
  const start = await createOAuthStart({
    platform,
    workspaceId: workspace.id,
    userId: session.userId
  });

  return NextResponse.redirect(start.url);
});
