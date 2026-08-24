-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "blurb" TEXT,
    "creatorId" TEXT,
    "submittedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'live',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAlias" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganicRanking" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "momentum" INTEGER NOT NULL DEFAULT 0,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganicRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsoredBid" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT,
    "paymentId" TEXT,
    "session" TEXT,
    "targetRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "SponsoredBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "webhookEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "session" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "handle" TEXT,
    "location" TEXT,
    "dailyHypeUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "entityId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "session" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Content_canonicalId_key" ON "Content"("canonicalId");

-- CreateIndex
CREATE INDEX "Content_category_status_idx" ON "Content"("category", "status");

-- CreateIndex
CREATE INDEX "Content_platform_platformKey_idx" ON "Content"("platform", "platformKey");

-- CreateIndex
CREATE INDEX "Content_canonicalId_idx" ON "Content"("canonicalId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAlias_url_key" ON "ContentAlias"("url");

-- CreateIndex
CREATE INDEX "ContentAlias_url_idx" ON "ContentAlias"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_platform_handle_key" ON "Creator"("platform", "handle");

-- CreateIndex
CREATE INDEX "Metric_contentId_fetchedAt_idx" ON "Metric"("contentId", "fetchedAt");

-- CreateIndex
CREATE INDEX "OrganicRanking_contentId_category_snapshotAt_idx" ON "OrganicRanking"("contentId", "category", "snapshotAt");

-- CreateIndex
CREATE INDEX "OrganicRanking_category_snapshotAt_idx" ON "OrganicRanking"("category", "snapshotAt");

-- CreateIndex
CREATE UNIQUE INDEX "SponsoredBid_idempotencyKey_key" ON "SponsoredBid"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SponsoredBid_contentId_status_idx" ON "SponsoredBid"("contentId", "status");

-- CreateIndex
CREATE INDEX "SponsoredBid_status_createdAt_idx" ON "SponsoredBid"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_webhookEventId_key" ON "Payment"("webhookEventId");

-- CreateIndex
CREATE INDEX "ModerationAction_contentId_status_idx" ON "ModerationAction"("contentId", "status");

-- CreateIndex
CREATE INDEX "ModerationAction_status_createdAt_idx" ON "ModerationAction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_scopeKey_key" ON "Subscription"("scopeKey");

-- CreateIndex
CREATE INDEX "Subscription_email_createdAt_idx" ON "Subscription"("email", "createdAt");

-- CreateIndex
CREATE INDEX "Subscription_entityId_createdAt_idx" ON "Subscription"("entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAlias" ADD CONSTRAINT "ContentAlias_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganicRanking" ADD CONSTRAINT "OrganicRanking_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredBid" ADD CONSTRAINT "SponsoredBid_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredBid" ADD CONSTRAINT "SponsoredBid_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
