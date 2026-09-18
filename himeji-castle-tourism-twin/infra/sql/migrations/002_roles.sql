-- 002_roles.sql — 読み取り専用ロール（3DCityDB MCP と Human Flow API が使う）
-- 既定パスワードは .env で上書きする（ここはローカル開発用の既定値）
\set ON_ERROR_STOP on
SET client_min_messages TO WARNING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'citydb_reader') THEN
    CREATE ROLE citydb_reader LOGIN PASSWORD 'citydb_reader';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mobility_writer') THEN
    CREATE ROLE mobility_writer LOGIN PASSWORD 'mobility_writer';
  END IF;
END $$;

-- 読み取り専用: citydb / citydb_pkg / mobility / public(PostGIS)
GRANT CONNECT ON DATABASE :"DBNAME" TO citydb_reader;
GRANT USAGE ON SCHEMA citydb, citydb_pkg, mobility, public TO citydb_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA citydb, mobility, public TO citydb_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA citydb_pkg, mobility, public TO citydb_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA citydb, mobility GRANT SELECT ON TABLES TO citydb_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA mobility GRANT EXECUTE ON FUNCTIONS TO citydb_reader;
-- セッション既定を読み取り専用に（MCP サーバも独自に default_transaction_read_only=on を設定する）
ALTER ROLE citydb_reader SET default_transaction_read_only = on;
ALTER ROLE citydb_reader SET statement_timeout = '30s';

-- 人流の書き込み（ETL / synthetic ローダ用）。citydb スキーマには書けない
GRANT CONNECT ON DATABASE :"DBNAME" TO mobility_writer;
GRANT USAGE ON SCHEMA mobility, public TO mobility_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mobility TO mobility_writer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA mobility TO mobility_writer;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mobility TO mobility_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA mobility GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mobility_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA mobility GRANT USAGE, SELECT ON SEQUENCES TO mobility_writer;
GRANT USAGE ON SCHEMA citydb TO mobility_writer;
GRANT SELECT ON ALL TABLES IN SCHEMA citydb TO mobility_writer;

INSERT INTO mobility.schema_migrations (version) VALUES ('002_roles') ON CONFLICT DO NOTHING;
