\set ON_ERROR_STOP on

\if :{?migrator_password}
\else
\echo 'ERROR: pass migrator_password with --set=migrator_password=...'
\quit 1
\endif

\if :{?runtime_password}
\else
\echo 'ERROR: pass runtime_password with --set=runtime_password=...'
\quit 1
\endif

SELECT length(:'migrator_password') >= 24 AS migrator_password_valid \gset
SELECT length(:'runtime_password') >= 24 AS runtime_password_valid \gset

\if :migrator_password_valid
\else
\echo 'ERROR: migrator_password must contain at least 24 characters'
\quit 1
\endif

\if :runtime_password_valid
\else
\echo 'ERROR: runtime_password must contain at least 24 characters'
\quit 1
\endif

SELECT format(
    'CREATE ROLE varta_migrator LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
    :'migrator_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'varta_migrator')
\gexec

SELECT format(
    'ALTER ROLE varta_migrator LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
    :'migrator_password'
)
\gexec

SELECT format(
    'CREATE ROLE varta_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
    :'runtime_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'varta_runtime')
\gexec

SELECT format(
    'ALTER ROLE varta_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
    :'runtime_password'
)
\gexec

ALTER ROLE varta_migrator SET search_path = varta, extensions;
ALTER ROLE varta_runtime SET search_path = varta, extensions;

GRANT CONNECT ON DATABASE :"DBNAME" TO varta_migrator, varta_runtime;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS varta AUTHORIZATION varta_migrator;
ALTER SCHEMA varta OWNER TO varta_migrator;

REVOKE ALL ON SCHEMA varta FROM PUBLIC, anon, authenticated, service_role;
REVOKE CREATE ON SCHEMA public FROM varta_migrator, varta_runtime;
GRANT USAGE, CREATE ON SCHEMA varta TO varta_migrator;
GRANT USAGE ON SCHEMA extensions TO varta_migrator;
GRANT USAGE ON SCHEMA varta, extensions TO varta_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE varta_migrator IN SCHEMA varta
    REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE varta_migrator IN SCHEMA varta
    REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE varta_migrator IN SCHEMA varta
    REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE varta_migrator IN SCHEMA varta
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO varta_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE varta_migrator IN SCHEMA varta
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO varta_runtime;

GRANT varta_migrator TO postgres;
