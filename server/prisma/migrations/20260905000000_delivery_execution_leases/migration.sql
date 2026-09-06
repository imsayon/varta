ALTER TABLE "varta"."deliveries" ADD COLUMN "lease_owner" TEXT, ADD COLUMN "lease_until" TIMESTAMPTZ;
CREATE INDEX "deliveries_status_lease_until_idx" ON "varta"."deliveries"("status", "lease_until");
