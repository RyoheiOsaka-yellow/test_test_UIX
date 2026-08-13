#!/usr/bin/env bash
# One-shot health check for the run. Prints OK lines and PROBLEM lines; exits non-zero if
# anything is wrong, so a supervisor loop or an operator can branch on it.
#
#   ./bin/health.sh            # processes, server, progress, liveness
#   ./bin/health.sh --deep     # also opens the page and checks it still renders (~10s)
#
# This reports the HARNESS's health, never the world's. "The city looks wrong" is not a health
# check, it is a finding, and it belongs to the agent.
#
# Every process check uses `ps -eo` with an anchored pattern rather than `pgrep -f`, because
# pgrep also matches the shell wrapper running this script — which is how a health check
# cheerfully reports two runners and one phantom agent.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
PORT="${AAABENCH_PORT:-5173}"
PROJECT="${PROJECT:-$ROOT/AgentCity}"
bad=0
say_ok()  { echo "  OK       $*"; }
say_bad() { echo "  PROBLEM  $*"; bad=1; }

# Count TREES, not ppid==1. A runner launched from a shell is not reparented to init until that
# shell exits, and a supervisor started with nohup from an interactive shell may never be — so
# the ppid==1 test reports zero supervisors while one is demonstrably running and logging.
#
# Every pattern below is ANCHORED AT THE START of the command line, and that is not fussiness.
# An unanchored pattern also matches two things that are not processes of interest: the shell
# that invoked this script (its own command line contains the words "run-agent.sh" and "vite",
# because it is running a command that mentions them) and awk itself (its argv holds the regex).
# Observed here on the first run: 1 phantom runner, 1 phantom dev server, and a "stale lock"
# alarm that followed from the phantom runner. A command line that STARTS with `bash <script>`
# or `node …/vite` is the real thing; `bash -c …` never is.
count_tree() {
  ps -eo pid,ppid,command | awk -v pat="$1" '
    $3 ~ /^-/ { next }                      # `bash -c …` is a wrapper, not the script
    $0 ~ pat { cmd[$1]=1; par[$1]=$2 }
    END { n=0; for (p in cmd) if (!(par[p] in cmd)) n++; print n+0 }'
}
runners=$(count_tree "^ *[0-9]+ +[0-9]+ +(/usr/bin/env +)?(/[^ ]*/)?bash +[^ -]*run-agent\.sh")
supers=$(count_tree "^ *[0-9]+ +[0-9]+ +(/usr/bin/env +)?(/[^ ]*/)?bash +[^ -]*supervise\.sh")
agents=$(ps -eo command | awk '/^claude -p/ {n++} END{print n+0}')
# `npm run dev` forks a node running vite; count the vite process, not the `sh -c vite` wrapper
# above it, or one dev server reads as two.
devs=$(ps -eo command | awk '/^(\/[^ ]*\/)?node .*\/vite( |$)/ {n++} END{print n+0}')

[ "${runners:-0}" -le 1 ] && say_ok "runners: ${runners:-0}"   || say_bad "${runners:-0} top-level runners (want 0 or 1)"
[ "${supers:-0}"  -le 1 ] && say_ok "supervisors: ${supers:-0}" || say_bad "${supers:-0} supervisors (want 0 or 1)"
[ "${agents:-0}"  -le 1 ] && say_ok "agents: ${agents:-0}"     || say_bad "${agents:-0} agents (want 0 or 1)"
[ "${devs:-0}"    -le 1 ] && say_ok "dev servers: ${devs:-0}"  || say_bad "${devs:-0} dev servers (want 0 or 1) — two servers on one project serve different builds"

# --- is the game being served? ----------------------------------------------
# Retry before judging: a dev server mid-rebuild can miss a single short probe while being
# perfectly fine, and a false PROBLEM here sends an operator hunting a bug that is not there.
code=""
for _ in 1 2 3 4; do
  code=$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" 2>/dev/null)
  [ "$code" = 200 ] && break
  sleep 3
done
[ "$code" = 200 ] && say_ok "dev server answering on :$PORT" || say_bad "nothing serving :$PORT after 4 tries (got '${code:-none}')"

# Whoever holds the port should be the dev server, not a leftover from a previous run.
holder=""
if command -v ss >/dev/null 2>&1; then
  holder=$(ss -ltnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print $NF; exit}')
elif command -v lsof >/dev/null 2>&1; then
  holder=$(lsof -nP -iTCP:"$PORT" 2>/dev/null | awk '/LISTEN/ {print $1; exit}')
fi
if [ -n "${holder:-}" ]; then
  case "$holder" in *node*|*vite*) say_ok "port held by node" ;; *) say_bad "port :$PORT held by '$holder', not the dev server" ;; esac
fi

# --- is it actually making progress? ----------------------------------------
last=$(git log -1 --format=%ct 2>/dev/null || echo 0)
mins=$(( ( $(date +%s) - last ) / 60 ))
agent_age=$(ps -eo etime,command | awk '/^ *[0-9:.-]+ +claude -p/ {print $1; exit}')
# A long generation pass or a texture bake writes files for a long time before anything is
# committed, so treat recent writes in the project as progress too.
recent_writes=$(find "$PROJECT/src" "$PROJECT/public" "$ROOT/docs" -newermt "-25 minutes" -type f 2>/dev/null | grep -v node_modules | head -1)
if [ -n "${recent_writes:-}" ] && [ "$mins" -gt 45 ]; then
  say_ok "no commit for ${mins} min, but files written in the last 25 (something is working)"
elif [ "$mins" -le 45 ]; then say_ok "last commit ${mins} min ago"
elif [ -z "${agent_age:-}" ] || [ "${#agent_age}" -le 5 ]; then
  say_ok "last commit ${mins} min ago (agent only just started — not a stall)"
else say_bad "no commit for ${mins} min — may be stalled"; fi

# --- is the AGENT alive, not merely present? --------------------------------
# Processes existing is NOT progress: a runner and a dev server can both be up for hours while
# the agent takes no turns at all. The transcript only grows when it is working.
tdir="$HOME/.claude/projects/$(echo "$ROOT" | tr '/.' '--')"
newest=$(ls -t "$tdir"/*.jsonl 2>/dev/null | head -1)
if [ -n "${newest:-}" ]; then
  age=$(( ( $(date +%s) - $(stat -c %Y "$newest" 2>/dev/null || echo 0) ) / 60 ))
  if [ "$age" -le 20 ]; then say_ok "agent taking turns (transcript ${age} min old)"
  elif [ "${agents:-0}" -eq 0 ]; then say_bad "no agent, and none has taken a turn for ${age} min"
  else say_bad "agent process exists but has not taken a turn for ${age} min — check the control surface"; fi
fi

# --- is it LOOKING? ---------------------------------------------------------
# Self-verification is the capability being measured, and captures are its footprint. An agent
# that has not photographed its own work in an hour is reported, never nudged: telling it to go
# and look is a hint, and the hint is the result you then cannot claim.
shot=$(ls -t /tmp/aaabench_qa/*.png 2>/dev/null | head -1)
if [ -n "${shot:-}" ]; then
  sage=$(( ( $(date +%s) - $(stat -c %Y "$shot" 2>/dev/null || echo 0) ) / 60 ))
  echo "  note     last capture ${sage} min ago ($(ls /tmp/aaabench_qa/*.png 2>/dev/null | wc -l | tr -d ' ') total)"
else
  echo "  note     no captures yet"
fi

# --- the lock should belong to the live runner ------------------------------
lp=$(cat /tmp/aaabench-web-agent.lock 2>/dev/null || echo "")
if [ -n "$lp" ] && kill -0 "$lp" 2>/dev/null; then say_ok "lock held by live runner $lp"
elif [ "${runners:-0}" -eq 0 ] && [ -z "$lp" ]; then say_ok "no runner, no lock (idle)"
else say_bad "lock stale or missing (value: '${lp:-none}')"; fi

# --- does the page still render? --------------------------------------------
if [ "${1:-}" = "--deep" ]; then
  out=$(timeout 90 node mcp/server.mjs --selftest 2>&1)
  echo "$out" | sed 's/^/           /'
  case "$out" in
    *"FLAT"*|*"never"*|*"FAILED"*|*"cannot reach"*) say_bad "the page is not rendering anything a camera can see" ;;
    *"frame:"*) say_ok "the page renders" ;;
    *) say_bad "the control surface did not answer" ;;
  esac
fi

exit $bad
