import { NextResponse, type NextRequest } from "next/server";
import { SocialPlatform } from "@prisma/client";
import { withApi } from "@/lib/api";
import { completeOAuth } from "@/lib/social/oauth";

type Context = { params: Promise<{ platform: string }> };

export const GET = withApi<Context>(async (request: NextRequest, { params }) => {
  const { platform: rawPlatform } = await params;
  const platform = rawPlatform.toUpperCase() as SocialPlatform;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL(request.url);

  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?oauth_error=${encodeURIComponent(
          url.searchParams.get("error_description") ?? error
        )}`,
        appUrl
      )
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?oauth_error=callback_non_valido", appUrl)
    );
  }

  if (!Object.values(SocialPlatform).includes(platform)) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?oauth_error=piattaforma_non_valida", appUrl)
    );
  }

  try {
    const result = await completeOAuth({ platform, code, state });
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?connected=${platform}&mock=${result.mock ? "1" : "0"}`,
        appUrl
      )
    );
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Errore OAuth";
    return NextResponse.redirect(
      new URL(`/dashboard/settings?oauth_error=${encodeURIComponent(message)}`, appUrl)
    );
  }
});
