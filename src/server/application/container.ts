// Composition root — wires concrete implementations into the application services.
// This is the ONLY place that decides which adapters/repos are used.
// Swapping SQLite→Postgres or stub→real Dodo = editing this file.

import { contentRepo, creatorRepo, metricRepo, rankingRepo, paymentRepo, moderationRepo, auditRepo, sessionRepo, subscriptionRepo } from "../repositories/prisma-impl";
import { idempotencyStore } from "../infrastructure/idempotency";
import { dodoProvider } from "../adapters/payments/dodo";
import { resolveAdapterForUrl, listPlatformAdapters } from "../adapters/platforms/interface";

// ensure all platform adapters are registered (import side-effect does this,
// but we reference it to make the dependency explicit)
import "./../adapters/platforms/adapters";

export const container = {
  repos: {
    content: contentRepo,
    creator: creatorRepo,
    metric: metricRepo,
    ranking: rankingRepo,
    payment: paymentRepo,
    moderation: moderationRepo,
    audit: auditRepo,
    session: sessionRepo,
    subscription: subscriptionRepo,
  },
  infra: {
    idempotency: idempotencyStore,
  },
  adapters: {
    platforms: listPlatformAdapters(),
    payments: {
      dodo: dodoProvider,
    },
    resolvePlatformForUrl: resolveAdapterForUrl,
  },
} as const;

export type Container = typeof container;
