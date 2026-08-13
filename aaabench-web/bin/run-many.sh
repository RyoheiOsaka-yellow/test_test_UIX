#!/usr/bin/env bash
# A long run as a sequence of COLD sessions: each one starts fresh and has to pick the work up
# from what the last one wrote down.
#
#   ./bin/run-many.sh 6
#
# This is the harder continuity test, and a different measurement from bin/supervise.sh, which
# resumes one conversation. Here nothing is remembered for it: if PROGRESS.md and its own design
# documents are not good enough to work from, the next session will show you exactly that.
set -uo pipefail
cd "$(dirname "$0")/.."
LOCK=/tmp/aaabench-web-run-many.lock
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  echo "A multi-session run is already going (pid $(cat "$LOCK")). Refusing to start a second."
  exit 1
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

N=${1:-6}
for i in $(seq 1 "$N"); do
  echo "=============== SESSION $i/$N  $(date +%H:%M) ==============="
  # No watchdog on purpose. Long document-writing produces ZERO tool calls for many minutes, so
  # anything that fingerprints tool activity kills a session that is merely thinking. Use
  # bin/supervise.sh to keep a run alive, and bin/health.sh to check whether it is working.
  FRESH=1 MAX_NUDGES=${MAX_NUDGES:-1} bin/run-agent.sh 2>&1 | tail -4
  src=$(find AgentCity/src -type f 2>/dev/null | wc -l | tr -d ' ')
  shots=$(ls /tmp/aaabench_qa/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "--- source files: $src | captures: $shots ---"
  sleep 5
done
echo "=============== RUN COMPLETE ==============="
