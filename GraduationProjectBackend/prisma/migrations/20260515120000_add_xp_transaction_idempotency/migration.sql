-- Add transaction-level idempotency so event retries cannot duplicate ledger rows.
ALTER TABLE "XpTransaction" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "XpTransaction_idempotencyKey_key" ON "XpTransaction"("idempotencyKey");
