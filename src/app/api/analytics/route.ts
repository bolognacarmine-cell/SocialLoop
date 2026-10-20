import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, parseQuery, requireWorkspace, withApi } from "@/lib/api";
import { getWorkspaceOverview } from "@/lib/analytics";

const querySchema = z.object({
  days: z.coerce.number().int().refine((value) => [7, 30, 90].includes(value)).default(30)
});

export const GET = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const query = parseQuery(request, querySchema);
  const overview = await getWorkspaceOverview(workspace.id, query.days as 7 | 30 | 90);
  return json({ overview });
});
