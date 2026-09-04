#!/usr/bin/env bash
#
# Applies every migration to a throwaway Postgres instance and exercises
# the Module 1 rules and the RLS policies against it.
#
#   ./supabase/tests/run.sh
#
# Requires a local PostgreSQL 16 server binary. Nothing here touches the
# hosted Supabase project.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
WORKDIR="${WORKDIR:-/tmp/piemr-pgtest}"
PORT="${PGPORT:-55432}"

export PATH="$PGBIN:$PATH"
export PGHOST="$WORKDIR" PGPORT="$PORT" PGUSER=postgres

cleanup() {
  pg_ctl -D "$WORKDIR/pgdata" stop -m immediate >/dev/null 2>&1 || true
}
trap cleanup EXIT

rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

# initdb refuses to run as root, so drop to the postgres system user when
# the caller is root.
RUN_AS=""
if [ "$(id -u)" -eq 0 ]; then
  chown postgres:postgres "$WORKDIR"
  chmod 700 "$WORKDIR"
  RUN_AS="su postgres -c"
fi

run() {
  if [ -n "$RUN_AS" ]; then su postgres -c "$1"; else bash -c "$1"; fi
}

run "$PGBIN/initdb -D $WORKDIR/pgdata -U postgres --auth=trust" >/dev/null
# Listen on the Unix socket only (-h ""), so a stale server or another
# Postgres on the machine cannot collide with us over a TCP port.
run "$PGBIN/pg_ctl -D $WORKDIR/pgdata -l $WORKDIR/pg.log -o '-p $PORT -k $WORKDIR -h \"\"' start" >/dev/null

createdb piemr

echo "--- applying migrations"
psql -q -d piemr -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/00_supabase_stub.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "    $(basename "$migration")"
  psql -q -d piemr -v ON_ERROR_STOP=1 -f "$migration"
done

echo "--- Module 1 registration rules"
psql -q -d piemr -f "$ROOT/supabase/tests/10_registration.sql"

echo "--- Row-Level Security"
psql -q -d piemr -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/20_rls.sql"

echo "--- Admin operations"
psql -q -d piemr -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/30_admin_ops.sql"

echo "--- done"
