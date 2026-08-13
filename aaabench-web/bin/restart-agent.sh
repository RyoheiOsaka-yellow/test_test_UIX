#!/usr/bin/env bash
# Restart the agent by hand WITHOUT racing supervise.sh.
#
#   ./bin/restart-agent.sh [note-file]        default: RESUME-NOTE.md
#
# The supervisor treats a missing lock as a dead runner, so clearing the lock by hand is
# indistinguishable from a crash and it will launch its own runner. That is how you end up with
# two agents on one working tree. This holds the supervisor off, stops the old runner, verifies
# it is really gone, starts the new one, then releases the supervisor.
#
# The note is operator text and goes into the subject's head: keep it to "prior work stands, here
# is where the standards changed". A note that explains what went wrong last session has handed
# the agent a finding it was supposed to make. See HARNESS-RULES.md.
set -uo pipefail
cd "$(dirname "$0")/.."
NOTE="${1:-RESUME-NOTE.md}"
PAUSE=/tmp/aaabench-supervisor.pause
LOCK=/tmp/aaabench-web-agent.lock
trap 'rm -f "$PAUSE"' EXIT

# Anchored patterns, for the same reason bin/health.sh anchors its counts: an unanchored match
# also hits the shell that launched this script and awk's own argv. Here that is not a false
# alarm on a dashboard — it is a kill list, and the shell it would kill is this one.
RUNNER_RE='^ *[0-9]+ +(/usr/bin/env +)?(/[^ ]*/)?bash +[^ -]*run-agent\.sh'
AGENT_RE='^ *[0-9]+ +claude -p'
pids() { ps -eo pid,command | awk -v re="$1" '$0 ~ re {print $1}'; }

touch "$PAUSE"; echo "supervisor paused"
for p in $(pids "$RUNNER_RE"); do kill "$p" 2>/dev/null; done
sleep 3
for p in $(pids "$AGENT_RE"); do kill "$p" 2>/dev/null; done
# verify, escalating — a kill that silently fails is how duplicates happen
for _ in 1 2 3 4 5; do
  left=$( { pids "$RUNNER_RE"; pids "$AGENT_RE"; } | wc -l )
  [ "$left" -eq 0 ] && break
  sleep 2
  for p in $(pids "$AGENT_RE"); do kill -9 "$p" 2>/dev/null; done
  for p in $(pids "$RUNNER_RE"); do kill -9 "$p" 2>/dev/null; done
done
rm -f "$LOCK"

if [ -f "$NOTE" ]; then
  nohup env RESUME_NOTE="$(cat "$NOTE")" MAX_NUDGES=${MAX_NUDGES:-20} bin/run-agent.sh > "/tmp/aaabench-runner-$(date +%H%M%S).out" 2>&1 &
  echo "restarted with note: $NOTE"
else
  nohup env MAX_NUDGES=${MAX_NUDGES:-20} bin/run-agent.sh > "/tmp/aaabench-runner-$(date +%H%M%S).out" 2>&1 &
  echo "restarted with no note"
fi
for _ in $(seq 1 20); do sleep 2; [ -s "$LOCK" ] && break; done
echo "runner up: $(cat "$LOCK" 2>/dev/null)"
