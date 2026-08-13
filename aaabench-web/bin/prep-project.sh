#!/usr/bin/env bash
# Verify the project is actually ready to be worked on, before an unattended run finds out for you.
#
#   ./bin/prep-project.sh [/path/to/AgentCity]
#
# It boots the game, looks at it through the same tools the agent will use, and says whether the
# sensors answer. A run that starts against a broken sensor chain produces hours of confident
# work nobody can see.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
PROJECT="${1:-$ROOT/AgentCity}"
PORT="${AAABENCH_PORT:-5173}"

[ -d "$PROJECT" ] || { echo "no project at $PROJECT — run bin/setup-capabilities.sh first"; exit 1; }
[ -d "$PROJECT/node_modules" ] || ( cd "$PROJECT" && npm install --no-audit --no-fund --silent )

started=""
if ! curl -s -m 2 -o /dev/null "http://127.0.0.1:$PORT/"; then
  ( cd "$PROJECT" && AAABENCH_PORT="$PORT" npm run dev >/tmp/aaabench-prep.log 2>&1 & echo $! > /tmp/aaabench-prep.pid )
  started=1
  for _ in $(seq 1 40); do sleep 1; curl -s -m 2 -o /dev/null "http://127.0.0.1:$PORT/" && break; done
fi
trap '[ -n "$started" ] && kill "$(cat /tmp/aaabench-prep.pid 2>/dev/null)" 2>/dev/null; rm -f /tmp/aaabench-prep.pid' EXIT

curl -s -m 3 -o /dev/null "http://127.0.0.1:$PORT/" || { echo "the dev server did not come up. /tmp/aaabench-prep.log:"; tail -20 /tmp/aaabench-prep.log; exit 1; }
echo "dev server: http://127.0.0.1:$PORT/"

echo
echo "== sensors"
node mcp/server.mjs --selftest || { echo "the control surface cannot see the game."; exit 1; }

echo
echo "== a shot, through the agent's own tool"
node tools/viewport.mjs shot prep-check --pose aerial || exit 1

echo
echo "ready. bin/run-agent.sh starts the run."
