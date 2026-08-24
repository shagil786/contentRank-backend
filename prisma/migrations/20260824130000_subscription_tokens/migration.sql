ALTER TABLE "Subscription" ADD COLUMN "confirmationTokenHash" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "confirmationExpiresAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "unsubscribeTokenHash" TEXT;
CREATE UNIQUE INDEX "Subscription_confirmationTokenHash_key" ON "Subscription"("confirmationTokenHash");
CREATE UNIQUE INDEX "Subscription_unsubscribeTokenHash_key" ON "Subscription"("unsubscribeTokenHash");
