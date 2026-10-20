import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/jwt";
import type { Membership, MembershipRole, Workspace } from "@prisma/client";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, details: error.details ?? null },
      { status: error.status }
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Dati non validi",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      { status: 422 }
    );
  }
  console.error("[api]", error);
  return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Non autenticato");
  return session;
}

export type WorkspaceContext = {
  session: SessionPayload;
  membership: Membership;
  workspace: Workspace;
};

export async function requireWorkspace(): Promise<WorkspaceContext> {
  const session = await requireSession();
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.userId,
        workspaceId: session.workspaceId
      }
    }
  });
  if (!membership) throw new ApiError(403, "Workspace non accessibile");
  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId }
  });
  if (!workspace) throw new ApiError(404, "Workspace non trovato");
  return { session, membership, workspace };
}

export function requireRole(
  context: WorkspaceContext,
  roles: MembershipRole[]
): void {
  if (!roles.includes(context.membership.role)) {
    throw new ApiError(403, "Permessi insufficienti");
  }
}

export async function parseBody<S extends ZodTypeAny>(
  request: NextRequest,
  schema: S
): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Body JSON non valido");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}

export function parseQuery<S extends ZodTypeAny>(request: NextRequest, schema: S): z.output<S> {
  const values: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    values[key] = value;
  });
  const parsed = schema.safeParse(values);
  if (!parsed.success) throw parsed.error;
  return parsed.data;
}

type Handler<Context> = (
  request: NextRequest,
  context: Context
) => Promise<NextResponse | Response>;

export function withApi<Context = unknown>(handler: Handler<Context>) {
  return async (request: NextRequest, context: Context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export function getIdFromParams(params: { id: string } | undefined) {
  if (!params?.id) throw new ApiError(400, "ID mancante");
  return params.id;
}
