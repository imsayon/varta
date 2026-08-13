-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE SCHEMA IF NOT EXISTS "varta";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

SET search_path = "varta", "extensions";

-- CreateEnum
CREATE TYPE "workspace_role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('PENDING', 'ENQUEUED', 'PARTIAL', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'DLQ');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'LEASED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "digest_batch_status" AS ENUM ('OPEN', 'PROCESSING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_uid" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_ai_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "base_url" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER,
    "prompt_version" TEXT,
    "request_id" TEXT,
    "status" TEXT NOT NULL,
    "error_category" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "role" "workspace_role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "permissions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "locale" TEXT DEFAULT 'en',
    "attributes" JSONB DEFAULT '{}',
    "preferences" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channels" JSONB NOT NULL,
    "digest_config" JSONB,
    "ai_personalize" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "natural_language" TEXT,
    "rule_ast" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "trigger_payload" JSONB DEFAULT '{}',
    "channels" TEXT[],
    "status" "notification_status" NOT NULL DEFAULT 'PENDING',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "smart_timing_requested" BOOLEAN NOT NULL DEFAULT false,
    "scheduled_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,
    "triggered_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "delivery_status" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "provider_message_id" TEXT,
    "scheduled_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_intents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "available_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" TEXT,
    "lease_until" TIMESTAMPTZ,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "delivery_id" UUID NOT NULL,
    "status" "delivery_status" DEFAULT 'PENDING',
    "provider" TEXT,
    "provider_message_id" TEXT,
    "rendered_content" JSONB,
    "provider_response" JSONB,
    "error_message" TEXT,
    "enqueued_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,
    "duration_ms" INTEGER,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "payload_hash" TEXT NOT NULL,
    "matched_attempt_id" UUID,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "aggregation_key" TEXT NOT NULL,
    "window_started_at" TIMESTAMPTZ NOT NULL,
    "window_expires_at" TIMESTAMPTZ NOT NULL,
    "status" "digest_batch_status" NOT NULL DEFAULT 'OPEN',
    "claimed_by" TEXT,
    "claimed_at" TIMESTAMPTZ,
    "lease_until" TIMESTAMPTZ,
    "aggregate_notification_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "digest_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_batch_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_id" UUID NOT NULL,
    "source_notification_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_inapp" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ,

    CONSTRAINT "pending_inapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "subscriber_id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "engagement_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriber_engagement_vectors" (
    "subscriber_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "embedding" vector(24),
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriber_engagement_vectors_pkey" PRIMARY KEY ("subscriber_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_uid_key" ON "oauth_accounts"("provider", "provider_uid");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_token_hash_key" ON "email_verifications"("token_hash");

-- CreateIndex
CREATE INDEX "email_verifications_user_id_idx" ON "email_verifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_ai_configs_workspace_id_key" ON "workspace_ai_configs"("workspace_id");

-- CreateIndex
CREATE INDEX "ai_usage_workspace_id_created_at_idx" ON "ai_usage"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_workspace_id_provider_model_idx" ON "ai_usage"("workspace_id", "provider", "model");

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_idx" ON "workspace_members"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_user_id_workspace_id_key" ON "workspace_members"("user_id", "workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_prefix_key" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "api_keys_workspace_id_idx" ON "api_keys"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_workspace_id_channel_key" ON "provider_configs"("workspace_id", "channel");

-- CreateIndex
CREATE INDEX "subscribers_workspace_id_idx" ON "subscribers"("workspace_id");

-- CreateIndex
CREATE INDEX "subscribers_workspace_id_email_idx" ON "subscribers"("workspace_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_workspace_id_external_id_key" ON "subscribers"("workspace_id", "external_id");

-- CreateIndex
CREATE INDEX "templates_workspace_id_idx" ON "templates"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "templates_workspace_id_name_key" ON "templates"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "routing_rules_workspace_id_priority_idx" ON "routing_rules"("workspace_id", "priority");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_idx" ON "notifications"("workspace_id");

-- CreateIndex
CREATE INDEX "notifications_subscriber_id_idx" ON "notifications"("subscriber_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_workspace_id_read_at_idx" ON "notifications"("workspace_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_workspace_id_idempotency_key_key" ON "notifications"("workspace_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "deliveries_workspace_id_status_idx" ON "deliveries"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "deliveries_status_scheduled_at_idx" ON "deliveries"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_notification_id_channel_key" ON "deliveries"("notification_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_intents_delivery_id_key" ON "outbox_intents"("delivery_id");

-- CreateIndex
CREATE INDEX "outbox_intents_status_available_at_idx" ON "outbox_intents"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_intents_lease_until_idx" ON "outbox_intents"("lease_until");

-- CreateIndex
CREATE INDEX "delivery_attempts_notification_id_idx" ON "delivery_attempts"("notification_id");

-- CreateIndex
CREATE INDEX "delivery_attempts_status_idx" ON "delivery_attempts"("status");

-- CreateIndex
CREATE INDEX "delivery_attempts_notification_id_channel_delivery_id_idx" ON "delivery_attempts"("notification_id", "channel", "delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_attempts_delivery_id_attempt_number_key" ON "delivery_attempts"("delivery_id", "attempt_number");

-- CreateIndex
CREATE INDEX "provider_webhook_events_provider_message_id_idx" ON "provider_webhook_events"("provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_webhook_events_provider_event_id_key" ON "provider_webhook_events"("provider", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "digest_batches_aggregate_notification_id_key" ON "digest_batches"("aggregate_notification_id");

-- CreateIndex
CREATE INDEX "digest_batches_workspace_id_status_window_expires_at_idx" ON "digest_batches"("workspace_id", "status", "window_expires_at");

-- CreateIndex
CREATE INDEX "digest_batches_aggregation_key_status_idx" ON "digest_batches"("aggregation_key", "status");

-- CreateIndex
CREATE INDEX "digest_batch_items_source_notification_id_idx" ON "digest_batch_items"("source_notification_id");

-- CreateIndex
CREATE UNIQUE INDEX "digest_batch_items_batch_id_source_notification_id_channel_key" ON "digest_batch_items"("batch_id", "source_notification_id", "channel");

-- CreateIndex
CREATE INDEX "pending_inapp_workspace_id_subscriber_id_delivered_at_idx" ON "pending_inapp"("workspace_id", "subscriber_id", "delivered_at");

-- CreateIndex
CREATE UNIQUE INDEX "pending_inapp_notification_id_key" ON "pending_inapp"("notification_id");

-- CreateIndex
CREATE INDEX "engagement_events_workspace_id_idx" ON "engagement_events"("workspace_id");

-- CreateIndex
CREATE INDEX "engagement_events_subscriber_id_event_type_idx" ON "engagement_events"("subscriber_id", "event_type");

-- CreateIndex
CREATE INDEX "engagement_events_occurred_at_idx" ON "engagement_events"("occurred_at");

-- CreateIndex
CREATE INDEX "subscriber_engagement_vectors_workspace_id_idx" ON "subscriber_engagement_vectors"("workspace_id");

-- pgvector approximate-nearest-neighbor index used by STO cosine-distance lookups.
CREATE INDEX "subscriber_engagement_vectors_embedding_hnsw_idx"
ON "subscriber_engagement_vectors" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_ai_configs" ADD CONSTRAINT "workspace_ai_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_intents" ADD CONSTRAINT "outbox_intents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_intents" ADD CONSTRAINT "outbox_intents_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_batches" ADD CONSTRAINT "digest_batches_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_batches" ADD CONSTRAINT "digest_batches_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_batches" ADD CONSTRAINT "digest_batches_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_batches" ADD CONSTRAINT "digest_batches_aggregate_notification_id_fkey" FOREIGN KEY ("aggregate_notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_batch_items" ADD CONSTRAINT "digest_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "digest_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_batch_items" ADD CONSTRAINT "digest_batch_items_source_notification_id_fkey" FOREIGN KEY ("source_notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_inapp" ADD CONSTRAINT "pending_inapp_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_inapp" ADD CONSTRAINT "pending_inapp_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_inapp" ADD CONSTRAINT "pending_inapp_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriber_engagement_vectors" ADD CONSTRAINT "subscriber_engagement_vectors_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriber_engagement_vectors" ADD CONSTRAINT "subscriber_engagement_vectors_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
