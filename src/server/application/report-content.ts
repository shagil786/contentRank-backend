// ReportContentService — users can flag content for moderation review.
// Background workers pick up open reports.

import { container } from "./container";
import { audit } from "../infrastructure/request-context";
import type { RequestContext } from "../infrastructure/request-context";
import { plainText } from "../infrastructure/text";

export interface ReportContentInput {
  contentId: string;
  reason: string;
}

export interface ReportContentResult {
  ok: boolean;
  reportId?: string;
  reason?: string;
}

export async function reportContent(
  input: ReportContentInput,
  ctx: RequestContext
): Promise<ReportContentResult> {
  const { repos } = container;
  const content = await repos.content.findById(input.contentId);
  if (!content) {
    return { ok: false, reason: "no_content" };
  }

  const report = await repos.moderation.insert({
    contentId: input.contentId,
    action: "report",
    reason: plainText(input.reason, 500),
    status: "open",
    session: ctx.session,
  });

  await audit(ctx, "moderation.report", "moderation", report.id, {
    contentId: input.contentId, reason: plainText(input.reason, 500), reportId: report.id,
  });

  return { ok: true, reportId: report.id };
}
