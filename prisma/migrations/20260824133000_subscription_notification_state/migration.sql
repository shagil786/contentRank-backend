ALTER TABLE "Subscription" ADD COLUMN "lastNotifiedRank" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "lastNotifiedContentId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "lastNotifiedAt" TIMESTAMP(3);
