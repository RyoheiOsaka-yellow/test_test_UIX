#!/usr/bin/env bash
# docker-entrypoint-initdb.d: 3dcitydb-initdb.sh（citydb スキーマ）の後に人流スキーマ mobility を作る
# 手動適用: docker compose exec citydb bash /docker-entrypoint-initdb.d/zz-mobility.sh
set -e
psql=( psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v DBNAME="$POSTGRES_DB" )
echo "Applying mobility migrations to database '$POSTGRES_DB' ..."
for f in /migrations/[0-9][0-9][0-9]_*.sql; do
  v=$(basename "$f" .sql)
  if "${psql[@]}" -tA -c "SELECT 1 FROM information_schema.tables WHERE table_schema='mobility' AND table_name='schema_migrations'" | grep -q 1 \
     && "${psql[@]}" -tA -c "SELECT 1 FROM mobility.schema_migrations WHERE version='$v'" | grep -q 1; then
    echo "  skip $v (applied)"; continue
  fi
  echo "  apply $v"
  "${psql[@]}" -f "$f" > /dev/null
done
# 読み取り専用ロールのパスワードを .env から反映
if [ -n "$MCP_DB_PASSWORD" ]; then "${psql[@]}" -c "ALTER ROLE citydb_reader PASSWORD '$MCP_DB_PASSWORD';" > /dev/null; fi
if [ -n "$MOBILITY_WRITER_PASSWORD" ]; then "${psql[@]}" -c "ALTER ROLE mobility_writer PASSWORD '$MOBILITY_WRITER_PASSWORD';" > /dev/null; fi
echo "mobility migrations done."
