import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, json, parseBody, parseQuery, requireWorkspace, withApi } from "@/lib/api";
import { getWorkspaceOverview, trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const querySchema = z.object({
  days: z.coerce.number().int().refine((value) => [7, 30, 90].includes(value)).default(30)
});

export const GET = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const query = parseQuery(request, querySchema);
  const overview = await getWorkspaceOverview(workspace.id, query.days as 7 | 30 | 90);
  return json({ overview });
});

// Beacon pubblico inviato dalla landing (visitatore non autenticato).
// Accettiamo solo PAGE_VIEW e lo attribuiamo alla landing pubblica, così le
// visite contano davvero. Rate limit per IP per evitare abusi.
const beaconSchema = z.object({
  type: z.literal("PAGE_VIEW"),
  landingPageId: z.string().nullish(),
  utm: z
    .record(z.string(), z.union([z.string(), z.null()]))
    .nullish()
    .transform((value) =>
      Object.fromEntries(
        Object.entries(value ?? {}).filter(
          ([, entry]) => typeof entry === "string" && entry.trim() !== ""
        )
      )
    )
});

type LandingRef = { id: string; workspaceId: string };

async function resolveLanding(
  request: NextRequest,
  landingPageId?: string | null
): Promise<LandingRef | null> {
  if (landingPageId) {
    const landing = await prisma.landingPage.findFirst({
      where: { id: landingPageId, published: true },
      select: { id: true, workspaceId: true }
    });
    if (landing) return landing;
  }

  // Il client non conosce sempre l'id: risaliamo allo slug dalla pagina Visitata.
  const referer = request.headers.get("referer");
  if (!referer) return null;
  let path: string;
  try {
    path = new URL(referer).pathname;
  } catch {
    return null;
  }
  const match = path.match(/^\/l\/([^/]+)\/?$/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]);
  return prisma.landingPage.findFirst({
    where: { slug, published: true },
    select: { id: true, workspaceId: true }
  });
}

export const POST = withApi(async (request: NextRequest) => {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`analytics:beacon:${ip}`, 60, 60_000);
  if (!limit.allowed) {
    throw new ApiError(429, "Troppe richieste. Riprova tra poco.");
  }

  const body = await parseBody(request, beaconSchema);

  const landing = await resolveLanding(request, body.landingPageId);
  if (!landing) {
    return json({ tracked: false }, { status: 202 });
  }

  await prisma.landingPage.update({
    where: { id: landing.id },
    data: { views: { increment: 1 } }
  });
  await trackEvent({
    workspaceId: landing.workspaceId,
    type: "PAGE_VIEW",
    name: "landing_view",
    landingPageId: landing.id,
    metadata: { utm: body.utm }
  });

  return json({ tracked: true }, { status: 202 });
});
