#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
	printf '%s\n' 'ERROR: DATABASE_URL must be set.' >&2
	exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"

# The repository's Supabase URL contains a relative certificate path. Running
# psql from server/ keeps that path valid without rewriting or printing it.
cd "$repo_root/server"

# Defense in depth: this command is an inventory tool, never a mutation tool.
export PGAPPNAME="varta-catalog-read-only"
export PGOPTIONS="${PGOPTIONS:-} -c default_transaction_read_only=on -c statement_timeout=30000"

exec psql --no-psqlrc --no-password "$DATABASE_URL" \
	-v ON_ERROR_STOP=1 \
	-P pager=off \
	-P footer=off <<'SQL'
\echo '=== connection and role ==='
select current_database() as database,
       current_user as role,
       current_setting('server_version') as postgres_version,
       coalesce((select ssl::text from pg_stat_ssl where pid = pg_backend_pid()), 'unknown') as tls;
select rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls, rolcanlogin
from pg_roles
where rolname = current_user or rolname in ('anon', 'authenticated', 'service_role', 'postgres')
order by rolname;

\echo '=== schemas ==='
select nspname as schema, pg_get_userbyid(nspowner) as owner
from pg_namespace
where nspname not like 'pg_%' and nspname <> 'information_schema'
order by nspname;

\echo '=== extensions ==='
select e.extname as extension, e.extversion as version, n.nspname as schema
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by e.extname;

\echo '=== application tables and columns ==='
select c.relname as table,
       string_agg(
           format('%s %s%s%s', a.attname, format_type(a.atttypid, a.atttypmod),
                  case when a.attnotnull then ' NOT NULL' else '' end,
                  case when pg_get_expr(d.adbin, d.adrelid) is not null
                       then ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid)
                       else '' end),
           ', ' order by a.attnum) as columns
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> '_prisma_migrations'
group by c.relname
order by c.relname;

\echo '=== indexes ==='
select tablename as table, indexname as index, indexdef
from pg_indexes
where schemaname = 'public' and tablename <> '_prisma_migrations'
order by tablename, indexname;

\echo '=== constraints ==='
select c.relname as table,
       con.conname as constraint,
       case con.contype when 'p' then 'PRIMARY KEY' when 'u' then 'UNIQUE'
            when 'f' then 'FOREIGN KEY' when 'c' then 'CHECK'
            when 'x' then 'EXCLUDE' else con.contype::text end as type,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname <> '_prisma_migrations'
order by c.relname, con.conname;

\echo '=== functions and triggers ==='
select n.nspname as schema, p.proname as function,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result,
       l.lanname as language,
       pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname, arguments;
select event_object_table as table, trigger_name, event_manipulation as event,
       action_timing, action_statement
from information_schema.triggers
where event_object_schema = 'public'
order by event_object_table, trigger_name;

\echo '=== RLS and policies ==='
select c.relname as table,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       coalesce(string_agg(p.polname || ':' || p.polcmd::text, ', ' order by p.polname), '') as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname <> '_prisma_migrations'
group by c.relname, c.relrowsecurity, c.relforcerowsecurity
order by c.relname;

\echo '=== anon and authenticated effective access ==='
select r.rolname as role,
       has_schema_privilege(r.rolname, 'public', 'USAGE') as schema_usage,
       string_agg(
           format('%s:%s/%s/%s/%s', c.relname,
                  has_table_privilege(r.rolname, format('public.%I', c.relname), 'SELECT'),
                  has_table_privilege(r.rolname, format('public.%I', c.relname), 'INSERT'),
                  has_table_privilege(r.rolname, format('public.%I', c.relname), 'UPDATE'),
                  has_table_privilege(r.rolname, format('public.%I', c.relname), 'DELETE')),
           ', ' order by c.relname) as table_privileges
from pg_roles r
cross join pg_class c
join pg_namespace n on n.oid = c.relnamespace
where r.rolname in ('anon', 'authenticated')
  and n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname <> '_prisma_migrations'
group by r.rolname
order by r.rolname;

\echo '=== migration metadata ==='
select migration_name, started_at, finished_at, rolled_back_at,
       applied_steps_count, logs is not null as has_logs
from public._prisma_migrations
order by started_at;
SQL
