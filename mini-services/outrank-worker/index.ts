// OUTRANK background worker service.
// Runs periodic jobs that never directly manipulate HTTP state — they call
// application/domain services. Jobs: metric refresh, ranking recalculation,
// moderation review, payment reconciliation, retry/dead-letter.

import { createServer } from "http";

// We import from the Next.js app's server layer (shared via tsconfig paths).
// In production this would be a separate package; here it shares src/.
import { container } from "../../src/server/application/container";
import { fetchLeaderboard } from "../../src/server/application/fetch-leaderboard";
import { computeSponsoredRanking } from "../../src/server/domain/ranking/sponsored";
import { newRequestContext } from "../../src/server/infrastructure/request-context";
import { sendResendEmail } from "../../src/server/infrastructure/email";
import { stableUnsubscribeToken } from "../../src/server/infrastructure/subscription-tokens";
import { captureServerError } from "../../src/server/infrastructure/error-tracker";

// ---- Jobs ----

// 1. Ranking recalculation — recompute organic ranks from latest scores.
//    Writes fresh OrganicRanking snapshots so history is preserved.
async function jobRankingRecalc() {
  const { repos } = container;
  const ctx = newRequestContext({ actor: "worker:ranking-recalc" });
  try {
    const contents = await repos.content.listAll("live");
    // global recompute: read latest score per content, sort, write snapshot
    const scored = [];
    for (const c of contents) {
      const h = await repos.ranking.organicHistory(c.id, 1);
      const latest = h[h.length - 1];
      scored.push({ content: c, score: latest?.score ?? 1000 });
    }
    scored.sort((a, b) => b.score - a.score || a.content.createdAt.getTime() - b.content.createdAt.getTime());
    for (let i = 0; i < scored.length; i++) {
      const s = scored[i];
      await repos.ranking.appendOrganicSnapshot({
        contentId: s.content.id,
        category: "global",
        rank: i + 1,
        score: s.score,
        momentum: 0,
      });
    }
    console.log(`[worker] ranking recalc: ${scored.length} entries ranked`);
  } catch (e) {
    console.error("[worker] ranking recalc failed:", e);
  }
}

// 2. Metric refresh — call platform adapters to fetch fresh engagement metrics.
//    Adapters without configured official API credentials return null safely.
async function jobMetricRefresh() {
  const { repos, adapters } = container;
  try {
    const contents = await repos.content.listAll("live");
    let refreshed = 0;
    let skipped = 0;
    let failed = 0;
    for (const c of contents.slice(0, 5)) { // quota-safe batch; rotate selection on later runs
      const adapter = adapters.platforms.find((a) => a.platform === c.platform);
      if (!adapter?.fetchMetrics) { skipped++; continue; }
      try {
        const m = await adapter.fetchMetrics(c.platformKey);
        if (!m) { skipped++; continue; }
        await repos.metric.append({ contentId: c.id, source: c.platform, ...m });
        refreshed++;
      } catch (error) {
        failed++;
        console.warn(`[worker] metric refresh failed for ${c.platform}:${c.platformKey}:`, error);
      }
    }
    console.log(`[worker] metric refresh: ${refreshed} updated, ${skipped} skipped, ${failed} failed`);
  } catch (e) {
    console.error("[worker] metric refresh failed:", e);
  }
}

// 3. Moderation review — auto-resolve stale open reports (older than 24h with no action).
async function jobModerationReview() {
  const { repos } = container;
  try {
    const open = await repos.moderation.listOpen();
    const now = Date.now();
    let resolved = 0;
    for (const r of open) {
      if (now - r.createdAt.getTime() > 24 * 3600_000) {
        await repos.moderation.resolve(r.id, "dismissed");
        resolved++;
      }
    }
    console.log(`[worker] moderation review: ${resolved} stale reports dismissed`);
  } catch (e) {
    console.error("[worker] moderation review failed:", e);
  }
}

// 4. Payment reconciliation — check for stuck "initiated" payments older than 1h.
async function jobPaymentReconciliation() {
  // In production: query Dodo API for payment status. Stub: just log.
  console.log("[worker] payment reconciliation: stub (would poll Dodo for stuck payments)");
}

// 5. Retry / dead-letter — in production this reads from a Redis queue.
async function jobRetryDeadLetter() {
  console.log("[worker] retry/dead-letter: stub (would process failed jobs from Redis queue)");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

// 6. Notification delivery — send one email when a confirmed subscription's
// watched rank changes. The stored last-notified state makes this idempotent.
async function jobNotificationDelivery() {
  const { repos } = container;
  const subscriptions = await repos.subscription.listConfirmed();
  if (!subscriptions.length || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.log(`[worker] notification delivery: skipped (${subscriptions.length} subscriptions, Resend not configured)`);
    return;
  }

  const board = await fetchLeaderboard("global", { limit: 48 });
  const byId = new Map(board.entries.map((entry) => [entry.content.id, entry]));
  const leader = board.entries[0];
  let sent = 0;
  let skipped = 0;

  for (const subscription of subscriptions) {
    const watched = subscription.entityId ? byId.get(subscription.entityId) : leader;
    if (!watched) { skipped++; continue; }
    if (!subscription.lastNotifiedContentId) {
      await repos.subscription.markNotified(subscription.id, watched.rank, watched.content.id);
      skipped++;
      continue;
    }
    if (subscription.lastNotifiedRank === watched.rank && subscription.lastNotifiedContentId === watched.content.id) {
      skipped++;
      continue;
    }

    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const unsubscribe = stableUnsubscribeToken(subscription.scopeKey).raw;
    const unsubscribeUrl = `${appUrl}/api/subscribe/unsubscribe?token=${unsubscribe}`;
    const subject = `${watched.content.title} moved to #${watched.rank} on OUTRANK`;
    const title = escapeHtml(watched.content.title);
    try {
      await sendResendEmail({
        to: subscription.email,
        subject,
        text: `${watched.content.title} is now ranked #${watched.rank}.\n\nUnsubscribe: ${unsubscribeUrl}`,
        html: `<p><strong>${title}</strong> is now ranked <strong>#${watched.rank}</strong> on OUTRANK.</p><p><a href="${unsubscribeUrl}">Unsubscribe</a></p>`,
      });
      await repos.subscription.markNotified(subscription.id, watched.rank, watched.content.id);
      sent++;
    } catch (error) {
      captureServerError("worker.notification_failed", error, { subscriptionId: subscription.id });
    }
  }
  console.log(`[worker] notification delivery: ${sent} sent, ${skipped} skipped`);
}

// ---- Scheduler ----
function schedule(name: string, fn: () => Promise<void>, intervalMs: number) {
  const run = async () => {
    const start = Date.now();
    await fn();
    const dur = Date.now() - start;
    console.log(`[worker] ${name} done in ${dur}ms`);
  };
  // run immediately, then on interval
  run();
  setInterval(run, intervalMs);
}

schedule("ranking-recalc", jobRankingRecalc, 5 * 60 * 1000);      // every 5 min
schedule("metric-refresh", jobMetricRefresh, 2 * 60 * 1000);      // every 2 min
schedule("moderation-review", jobModerationReview, 10 * 60 * 1000); // every 10 min
schedule("payment-reconciliation", jobPaymentReconciliation, 5 * 60 * 1000);
schedule("retry-dead-letter", jobRetryDeadLetter, 15 * 60 * 1000);
schedule("notification-delivery", jobNotificationDelivery, 2 * 60 * 1000);

// tiny HTTP health endpoint
const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "outrank-worker" }));
});

const PORT = 3005;
httpServer.listen(PORT, () => {
  console.log(`OUTRANK background worker running on port ${PORT}`);
});

process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
