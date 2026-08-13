SET search_path = "varta", "extensions";

-- CreateEnum
CREATE TYPE "subscription_state" AS ENUM ('PENDING', 'ACTIVE', 'GRACE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "billing_webhook_status" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "usage_ledger_kind" AS ENUM ('NOTIFICATION_RESERVATION', 'NOTIFICATION_COMPENSATION', 'AI_RESERVATION', 'AI_COMPENSATION');

-- CreateTable
CREATE TABLE "billing_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "razorpay_customer_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_account_workspaces" (
    "billing_account_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_account_workspaces_pkey" PRIMARY KEY ("billing_account_id","workspace_id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "billing_account_id" UUID NOT NULL,
    "plan_id" TEXT NOT NULL,
    "plan_version" TEXT NOT NULL,
    "status" "subscription_state" NOT NULL DEFAULT 'PENDING',
    "razorpay_subscription_id" TEXT,
    "checkout_operation_id" TEXT,
    "current_period_start" TIMESTAMPTZ,
    "current_period_end" TIMESTAMPTZ,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "grace_expires_at" TIMESTAMPTZ,
    "provider_status" TEXT,
    "provider_updated_at" TIMESTAMPTZ,
    "last_event_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_ciphertext" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "signature_hash" TEXT NOT NULL,
    "status" "billing_webhook_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMPTZ,
    "lease_until" TIMESTAMPTZ,
    "provider_created_at" TIMESTAMPTZ,
    "error_code" TEXT,
    "error_message" TEXT,
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "billing_account_id" UUID NOT NULL,
    "workspace_id" UUID,
    "operation_id" TEXT NOT NULL,
    "kind" "usage_ledger_kind" NOT NULL DEFAULT 'NOTIFICATION_RESERVATION',
    "delta_units" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "billing_account_id" UUID NOT NULL,
    "plan_id" TEXT NOT NULL,
    "plan_version" TEXT NOT NULL,
    "source_event_id" TEXT,
    "can_accept_notifications" BOOLEAN NOT NULL,
    "can_access_ai" BOOLEAN NOT NULL,
    "limits_json" JSONB NOT NULL,
    "snapshot_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "billing_account_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "source_event_id" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_owner_user_id_key" ON "billing_accounts"("owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_razorpay_customer_id_key" ON "billing_accounts"("razorpay_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_account_workspaces_workspace_id_key" ON "billing_account_workspaces"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_razorpay_subscription_id_key" ON "subscriptions"("razorpay_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_checkout_operation_id_key" ON "subscriptions"("checkout_operation_id");

-- CreateIndex
CREATE INDEX "subscriptions_billing_account_id_status_idx" ON "subscriptions"("billing_account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhook_events_event_id_key" ON "billing_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "billing_webhook_events_status_available_at_idx" ON "billing_webhook_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "billing_webhook_events_event_type_status_idx" ON "billing_webhook_events"("event_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "usage_ledger_operation_id_key" ON "usage_ledger"("operation_id");

-- CreateIndex
CREATE INDEX "usage_ledger_billing_account_id_kind_period_start_idx" ON "usage_ledger"("billing_account_id", "kind", "period_start");

-- CreateIndex
CREATE INDEX "entitlement_snapshots_billing_account_id_snapshot_at_idx" ON "entitlement_snapshots"("billing_account_id", "snapshot_at");

-- CreateIndex
CREATE INDEX "billing_audit_events_billing_account_id_created_at_idx" ON "billing_audit_events"("billing_account_id", "created_at");

-- CreateIndex
CREATE INDEX "billing_audit_events_source_event_id_idx" ON "billing_audit_events"("source_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_workspace_id_request_id_key" ON "ai_usage"("workspace_id", "request_id");

-- AddForeignKey
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_account_workspaces" ADD CONSTRAINT "billing_account_workspaces_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_account_workspaces" ADD CONSTRAINT "billing_account_workspaces_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_snapshots" ADD CONSTRAINT "entitlement_snapshots_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_audit_events" ADD CONSTRAINT "billing_audit_events_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OAuth is identity-only; provider bearer credentials are never persisted.
ALTER TABLE "oauth_accounts"
    DROP COLUMN "access_token",
    DROP COLUMN "refresh_token",
    DROP COLUMN "expires_at";

-- Cover every foreign key flagged by the Supabase performance advisor.
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");
CREATE INDEX "notifications_template_id_idx" ON "notifications"("template_id");
CREATE INDEX "outbox_intents_workspace_id_idx" ON "outbox_intents"("workspace_id");
CREATE INDEX "digest_batches_subscriber_id_idx" ON "digest_batches"("subscriber_id");
CREATE INDEX "digest_batches_template_id_idx" ON "digest_batches"("template_id");
CREATE INDEX "pending_inapp_subscriber_id_idx" ON "pending_inapp"("subscriber_id");
CREATE INDEX "engagement_events_notification_id_idx" ON "engagement_events"("notification_id");
