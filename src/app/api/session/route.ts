// POST /api/session — create a session (lightweight auth). Returns sessionId.
// Called by the realtime engine on socket connect so boosts can be attributed.
import { NextRequest } from "next/server";
import { jsonResponse } from "@/server/infrastructure/api-helpers";
import { container } from "@/server/application/container";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { handle?: string; location?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }
  const session = await container.repos.session.create();
  if (body.handle || body.location) {
    await container.repos.session.touch(session.id, { handle: body.handle, location: body.location });
  }
  return jsonResponse({ sessionId: session.id }, 200, { sessionId: session.id });
}
