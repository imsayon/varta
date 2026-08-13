\set ON_ERROR_STOP on

BEGIN;

DO $block$
DECLARE
    expected_tables text[] := ARRAY[
        'users', 'oauth_accounts', 'sessions', 'refresh_tokens',
        'email_verifications', 'password_reset_tokens', 'workspaces',
        'workspace_members', 'api_keys', 'provider_configs', 'subscribers',
        'templates', 'routing_rules', 'notifications', 'delivery_attempts',
        'pending_inapp', 'engagement_events', 'workspace_ai_configs',
        'ai_usage', 'digest_batches', 'digest_batch_items',
        'subscriber_engagement_vectors', 'deliveries', 'outbox_intents',
        'provider_webhook_events'
    ];
    missing_tables text[];
    private_table_count integer;
    prisma_history_count bigint;
BEGIN
    SELECT array_agg(table_name ORDER BY table_name)
    INTO missing_tables
    FROM unnest(expected_tables) AS table_name
    WHERE to_regclass(format('public.%I', table_name)) IS NULL;

    IF missing_tables IS NOT NULL THEN
        RAISE EXCEPTION 'public adoption aborted; missing expected tables: %', missing_tables;
    END IF;

    SELECT count(*)
    INTO private_table_count
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'varta'
      AND relation.relkind IN ('r', 'p');

    IF private_table_count <> 0 THEN
        RAISE EXCEPTION 'public adoption aborted; varta already contains % tables', private_table_count;
    END IF;

    IF to_regclass('public._prisma_migrations') IS NULL THEN
        RAISE EXCEPTION 'public adoption aborted; public._prisma_migrations is missing';
    END IF;

    SELECT count(*) INTO prisma_history_count FROM public._prisma_migrations;
    IF prisma_history_count <> 0 THEN
        RAISE EXCEPTION 'public adoption aborted; public Prisma history contains % rows', prisma_history_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension AS extension
        JOIN pg_namespace AS namespace ON namespace.oid = extension.extnamespace
        WHERE extension.extname = 'vector' AND namespace.nspname = 'public'
    ) THEN
        RAISE EXCEPTION 'public adoption aborted; vector is not installed in public';
    END IF;
END
$block$;

LOCK TABLE
    public.users, public.oauth_accounts, public.sessions, public.refresh_tokens,
    public.email_verifications, public.password_reset_tokens, public.workspaces,
    public.workspace_members, public.api_keys, public.provider_configs,
    public.subscribers, public.templates, public.routing_rules,
    public.notifications, public.delivery_attempts, public.pending_inapp,
    public.engagement_events, public.workspace_ai_configs, public.ai_usage,
    public.digest_batches, public.digest_batch_items,
    public.subscriber_engagement_vectors, public.deliveries,
    public.outbox_intents, public.provider_webhook_events,
    public._prisma_migrations
IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE varta_adoption_counts (
    table_name text PRIMARY KEY,
    exact_rows bigint NOT NULL
) ON COMMIT DROP;

DO $block$
DECLARE
    table_name text;
    exact_rows bigint;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users', 'oauth_accounts', 'sessions', 'refresh_tokens',
        'email_verifications', 'password_reset_tokens', 'workspaces',
        'workspace_members', 'api_keys', 'provider_configs', 'subscribers',
        'templates', 'routing_rules', 'notifications', 'delivery_attempts',
        'pending_inapp', 'engagement_events', 'workspace_ai_configs',
        'ai_usage', 'digest_batches', 'digest_batch_items',
        'subscriber_engagement_vectors', 'deliveries', 'outbox_intents',
        'provider_webhook_events'
    ]
    LOOP
        EXECUTE format('SELECT count(*) FROM public.%I', table_name) INTO exact_rows;
        INSERT INTO varta_adoption_counts VALUES (table_name, exact_rows);
    END LOOP;
END
$block$;

DO $block$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users', 'oauth_accounts', 'sessions', 'refresh_tokens',
        'email_verifications', 'password_reset_tokens', 'workspaces',
        'workspace_members', 'api_keys', 'provider_configs', 'subscribers',
        'templates', 'routing_rules', 'notifications', 'delivery_attempts',
        'pending_inapp', 'engagement_events', 'workspace_ai_configs',
        'ai_usage', 'digest_batches', 'digest_batch_items',
        'subscriber_engagement_vectors', 'deliveries', 'outbox_intents',
        'provider_webhook_events'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I SET SCHEMA varta', table_name);
        EXECUTE format('ALTER TABLE varta.%I OWNER TO varta_migrator', table_name);
    END LOOP;
END
$block$;

ALTER TYPE public.workspace_role SET SCHEMA varta;
ALTER TYPE public.notification_status SET SCHEMA varta;
ALTER TYPE public.delivery_status SET SCHEMA varta;
ALTER TYPE public."NotificationPriority" SET SCHEMA varta;
ALTER TYPE public.outbox_status SET SCHEMA varta;
ALTER TYPE public.digest_batch_status SET SCHEMA varta;

ALTER TYPE varta.workspace_role OWNER TO varta_migrator;
ALTER TYPE varta.notification_status OWNER TO varta_migrator;
ALTER TYPE varta.delivery_status OWNER TO varta_migrator;
ALTER TYPE varta."NotificationPriority" OWNER TO varta_migrator;
ALTER TYPE varta.outbox_status OWNER TO varta_migrator;
ALTER TYPE varta.digest_batch_status OWNER TO varta_migrator;

ALTER EXTENSION vector SET SCHEMA extensions;
DROP TABLE public._prisma_migrations;

DO $block$
DECLARE
    row_snapshot record;
    adopted_rows bigint;
BEGIN
    FOR row_snapshot IN SELECT table_name, exact_rows FROM varta_adoption_counts
    LOOP
        EXECUTE format('SELECT count(*) FROM varta.%I', row_snapshot.table_name) INTO adopted_rows;
        IF adopted_rows <> row_snapshot.exact_rows THEN
            RAISE EXCEPTION 'row-count mismatch for %: before %, after %',
                row_snapshot.table_name, row_snapshot.exact_rows, adopted_rows;
        END IF;
    END LOOP;
END
$block$;

REVOKE ALL ON SCHEMA varta FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA varta FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA varta FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA varta, extensions TO varta_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA varta TO varta_runtime;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA varta TO varta_runtime;

COMMIT;
