// PATCH /api/content/[id] — update editable content details.
// This uses the application repository boundary and keeps the mutation auditable.
import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse } from "@/server/infrastructure/api-helpers";
import { container } from "@/server/application/container";
import { audit } from "@/server/infrastructure/request-context";
import { plainText } from "@/server/infrastructure/text";

export const dynamic = "force-dynamic";

interface EditBody { title?: unknown; blurb?: unknown; sub?: unknown; link?: unknown }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const prepared = await prepareApiContext(req, "general");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;
  const { id } = await params;
  let body: EditBody;
  try { body = await req.json() as EditBody; }
  catch { return jsonResponse({ ok: false, reason: "bad_json" }, 400, { requestId: ctx.requestId, sessionId: ctx.session }); }

  const existing = await container.repos.content.findById(id);
  if (!existing) return jsonResponse({ ok: false, reason: "not_found" }, 404, { requestId: ctx.requestId, sessionId: ctx.session });
  const withinEditWindow = Date.now() - existing.createdAt.getTime() <= 24 * 60 * 60 * 1000;
  if (!existing.submittedBy || existing.submittedBy !== ctx.session || !withinEditWindow) {
    return jsonResponse({ ok: false, reason: "edit_forbidden" }, 403, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  const title = typeof body.title === "string" ? plainText(body.title, 1000) : undefined;
  const blurb = typeof body.blurb === "string" ? plainText(body.blurb, 1000) : typeof body.sub === "string" ? plainText(body.sub, 1000) : undefined;
  const url = typeof body.link === "string" ? body.link.trim() : undefined;
  if (title !== undefined && (title.length < 1 || title.length > 160)) return jsonResponse({ ok: false, reason: "invalid_title" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  if (blurb !== undefined && blurb.length > 500) return jsonResponse({ ok: false, reason: "invalid_blurb" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  if (url !== undefined && url && !/^https?:\/\/[^\s]+$/i.test(url)) return jsonResponse({ ok: false, reason: "invalid_link" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  if (title === undefined && blurb === undefined && url === undefined) return jsonResponse({ ok: false, reason: "no_changes" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });

  const content = await container.repos.content.update(id, { title, blurb, url });
  await audit(ctx, "content.edit", "content", id, {
    fields: Object.keys({ title, blurb, url }).filter((key) => ({ title, blurb, url } as Record<string, unknown>)[key] !== undefined),
    before: { title: existing.title, blurb: existing.blurb, url: existing.url },
    after: { title: content.title, blurb: content.blurb, url: content.url },
  });
  return jsonResponse({ ok: true, content }, 200, { requestId: ctx.requestId, sessionId: ctx.session });
}
