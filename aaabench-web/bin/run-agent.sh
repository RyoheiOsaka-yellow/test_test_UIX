#!/usr/bin/env bash
# Boot the game, hand over the demand, and keep the session alive for as long as it will run.
#
#   ./bin/run-agent.sh
#   MAX_NUDGES=20 ./bin/run-agent.sh          # a day of unattended work
#   AGENT=codex ./bin/run-agent.sh            # a different CLI under test
#   DRY_RUN=1 ./bin/run-agent.sh              # boot and print the plan, run no agent
#
# Prereqs (one-time): ./bin/setup-capabilities.sh
set -uo pipefail
cd "$(dirname "$0")/.."   # anchor at the repo root
ROOT="$PWD"

# One runner at a time. Two runners means two agents editing one working tree through one dev
# server, and the symptom is not an error — it is two conversations interleaving edits to the same
# files, which reads as the agent contradicting itself.
# Deliberately a different lock file from run-many.sh's, which holds its own while calling this
# script sequentially; sharing one would deadlock that loop on its first iteration.
LOCK=/tmp/aaabench-web-agent.lock
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  echo "An agent session is already running (pid $(cat "$LOCK")). Refusing to start a second."
  echo "Two agents on one working tree interleave their edits. Stop that session first."
  exit 1
fi
echo $$ > "$LOCK"
# Remove only the lock. Never kill the dev server here: it is shared, the agent restarts it
# itself when it dies, and a nudge resumes into the same one.
trap 'rm -f "$LOCK"' EXIT

PROJECT="${PROJECT:-$ROOT/AgentCity}"
PORT="${AAABENCH_PORT:-5173}"
URL="http://127.0.0.1:$PORT/"
DEV_LOG=/tmp/aaabench-dev.log
DEV_PID=/tmp/aaabench-dev.pid

[ -d "$PROJECT" ] || { echo "no project at $PROJECT — run ./bin/setup-capabilities.sh first"; exit 1; }
[ -d "$ROOT/node_modules" ] || { echo "harness dependencies missing — run ./bin/setup-capabilities.sh first"; exit 1; }
echo "project: $PROJECT"

# 1. The game has to be SERVING and RENDERING. Those are two different failures and the second
#    one is the quiet one: a dev server that answers 200 with a page that throws during boot
#    looks healthy to curl and shows the agent a blank void.
serving() { curl -s -m 3 -o /dev/null "$URL"; }

boot_game() {
  if serving; then
    return 0
  fi
  # Something dead may still hold the port. Vite is configured strictPort, so a squatter means
  # the new server exits immediately rather than quietly serving a different port — clear it.
  if command -v fuser >/dev/null 2>&1; then fuser -k "$PORT/tcp" >/dev/null 2>&1; fi
  [ -s "$DEV_PID" ] && kill "$(cat "$DEV_PID")" 2>/dev/null
  sleep 1
  echo "starting the dev server…"
  ( cd "$PROJECT" && AAABENCH_PORT="$PORT" nohup npm run dev >"$DEV_LOG" 2>&1 & echo $! > "$DEV_PID" )
  printf "waiting for %s" "$URL"
  for _ in $(seq 1 "${DEV_WAIT_TRIES:-60}"); do
    sleep 2; printf "."
    serving && { echo " up"; return 0; }
  done
  echo
  return 1
}

boot_game || {
  echo "the dev server never came up. Last lines of $DEV_LOG:"
  tail -20 "$DEV_LOG" 2>/dev/null
  echo "A broken build is the agent's problem, not the harness's — but a dev server that cannot"
  echo "even start is ours. If the project's dependencies are gone: (cd $PROJECT && npm install)."
  exit 1
}

# Does the page actually render? Reported, never fixed: if the agent broke its own build, that is
# the thing being measured, and this run should start with it broken and the sensors saying so.
if [ -z "${SKIP_PROBE:-}" ]; then
  echo "== sensors"
  node mcp/server.mjs --selftest 2>&1 | sed 's/^/  /' || echo "  (the control surface could not read the page — the session starts with that as-is)"
fi

# 2. MCP config for the agent CLI.
CFG="$ROOT/.mcp.json"
if [ ! -f "$CFG" ]; then
  cat > "$CFG" <<JSON
{ "mcpServers": { "agentcity": { "command": "node", "args": ["$ROOT/mcp/server.mjs"], "env": { "AAABENCH_PORT": "$PORT" } } } }
JSON
  echo "wrote MCP config: $CFG"
fi

# Keys, if present, become part of the session environment — the agent discovers them as
# capabilities rather than being told they exist. keys.env is gitignored; never commit it.
for kf in "$ROOT/keys.env" "$HOME/.aaabench-keys.env"; do
  [ -f "$kf" ] && { set -a; . "$kf"; set +a; echo "loaded $(basename "$kf")"; break; }
done

mkdir -p /tmp/aaabench_qa /tmp/aaabench_refs
LOG="$ROOT/session-$(date +%H%M%S).log"

MAX_NUDGES=${MAX_NUDGES:-4}      # resumes after a CLEAN stop; each is a full session.
                                 # Raise it for long unattended runs (MAX_NUDGES=20 ~= a day).

# Run from the REPO ROOT, not the project dir: docs/, .claude/skills/ and tools/ all live here,
# and every path in PROMPT.md is written relative to it.
# AGENT selects the CLI under test. Each preset takes a prompt on argv and must be able to reach
# the MCP server in $CFG. Add your own; the harness only needs the process to run headless, to
# have file + shell access, and to exit when it is done.
AGENT="${AGENT:-claude}"
MODEL="${MODEL:-claude-opus-5}"

# The agent legitimately runs long background jobs — generator passes, texture bakes, asset
# fetches. A ceiling on waiting for them kills a session mid-work. Wait indefinitely instead.
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0
# Keep the context bounded so a long-lived resumed session stays affordable: without a cap, a
# session that is resumed twenty times spends most of its tokens re-reading its own conversation
# rather than working. Compact by plan (500k) under the ceiling (600k), not as an emergency.
export CLAUDE_CODE_MAX_CONTEXT_TOKENS=${CLAUDE_CODE_MAX_CONTEXT_TOKENS:-600000}
export CLAUDE_CODE_AUTO_COMPACT_WINDOW=${CLAUDE_CODE_AUTO_COMPACT_WINDOW:-500000}

# Claude Code refuses --dangerously-skip-permissions when it is running as root, which is exactly
# what happens in most containers — and the refusal is a one-line message that looks like a bad
# flag rather than a policy. Setting IS_SANDBOX=1 is the documented way to say "this really is a
# throwaway container"; it stays an explicit operator decision (ALLOW_ROOT=1), because asserting
# it on a real machine hands an unattended agent full permissions on someone's box.
# The test is against the exact value "1", not merely "set": some images export IS_SANDBOX=yes,
# which does not satisfy the CLI and would make this check skip a container that still needs it.
if [ "$AGENT" = claude ] && [ "$(id -u)" = 0 ] && [ "${IS_SANDBOX:-}" != "1" ]; then
  if [ -n "${ALLOW_ROOT:-}" ]; then
    export IS_SANDBOX=1
    echo "running as root in a container (ALLOW_ROOT=1) — IS_SANDBOX=1 set for the agent CLI"
  else
    echo "NOTE: running as root. Claude Code will refuse --dangerously-skip-permissions."
    echo "      Run as a normal user, or set ALLOW_ROOT=1 if this is a disposable container."
  fi
fi

agent_run() {   # $1 = prompt, $2 = session id to resume (optional, claude only)
  if [ -n "${DRY_RUN:-}" ]; then
    echo "DRY_RUN: would run $AGENT (model $MODEL) with $(printf '%s' "$1" | wc -c) bytes of prompt${2:+, resuming $2}"
    echo '{"session_id":"dry-run","subtype":"success","is_error":false,"duration_ms":0}'
    return 0
  fi
  case "$AGENT" in
    claude)
      if [ -n "${2:-}" ]; then
        claude -p "$1" --resume "$2" --mcp-config "$CFG" --output-format json \
          --dangerously-skip-permissions --model "$MODEL"
      else
        claude -p "$1" --mcp-config "$CFG" --output-format json \
          --dangerously-skip-permissions --model "$MODEL"
      fi ;;
    codex)   codex exec --dangerously-bypass-approvals-and-sandbox "$1" ;;
    gemini)  gemini --yolo --prompt "$1" ;;
    custom)  [ -n "${AGENT_CMD:-}" ] || { echo "AGENT=custom needs AGENT_CMD set" >&2; exit 2; }
             eval "$AGENT_CMD" ;;      # AGENT_CMD may reference "$1"
    *) echo "unknown AGENT=$AGENT (claude|codex|gemini|custom)" >&2; exit 2 ;;
  esac
}
field() { python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get(sys.argv[2],''))" "$1" "$2" 2>/dev/null; }

# NOTE=<file> prepends a restart preamble (e.g. "keep what you built, here is what changed").
# It must not carry diagnosis: a note that explains what went wrong last session has handed the
# agent a finding it was supposed to produce. See HARNESS-RULES.md.
PROMPT="$(cat PROMPT.md)"
[ -n "${NOTE:-}" ] && [ -f "$NOTE" ] && PROMPT="$(cat "$NOTE")

---

$PROMPT" && echo "prepended restart note: $NOTE"

# CONTINUE BY DEFAULT. A cold start re-reads the whole brief before doing any work; resuming
# keeps the context it already has, so it costs almost nothing to pick up. FRESH=1 forces a
# genuine cold start (to test cold-start continuity, or after a big change to the demand).
LAST_ID="$ROOT/.last-session-id"
echo "agent starting — log: $LOG"
if [ -z "${FRESH:-}" ] && [ -s "$LAST_ID" ]; then
  PREV="$(cat "$LAST_ID")"
  echo "continuing session $PREV (FRESH=1 forces a cold start)"
  agent_run "${RESUME_NOTE:+$RESUME_NOTE

}Continue. Same world, same plan — pick up exactly where you left off, starting with \
whatever you had queued. If anything about the demand or your environment has changed since you \
last looked, you will find it in PROMPT.md and docs/; check only if something surprises you. \
Append to PROGRESS.md as you go. Do not stop to ask or wait — nobody is coming." "$PREV" | tee "$LOG"
else
  agent_run "$PROMPT" | tee "$LOG"
fi
SID=$(field "$LOG" session_id)
# A dry run must not leave a session id behind: the next real run would try to resume the string
# "dry-run", which fails in a way that looks like a broken agent rather than a broken harness.
[ -n "$SID" ] && [ -z "${DRY_RUN:-}" ] && echo "$SID" > "$LAST_ID"

# The brief says "work until you are cut off", so ANY clean exit is the agent stopping by choice —
# it wrote a handover and put its tools down. There are only two honest reasons a session should
# end: a usage limit, or an error. So resume on every clean stop.
#
# RESUME the same session (not a fresh one): its plan, its file knowledge and its half-finished
# thought are all still in that conversation, so it carries on instead of re-deriving the world.
hit_limit() {
  grep -qiF "hit your session limit" "$1" 2>/dev/null ||
  grep -qiF "hit your usage limit"   "$1" 2>/dev/null
}

# A 529/5xx from the API is not the agent stopping and must not cost a nudge. Checked from the
# parsed JSON rather than by matching text, so a session that merely *discusses* an API error is
# not mistaken for one that hit it. TRUE only when the session ended for a reason that is NOT the
# agent deciding to stop — all of it transient, all of it to be retried for free.
api_error() {
  python3 - "$1" <<'PYEOF' 2>/dev/null
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)          # unreadable log == something went wrong, so retry rather than count it
bad = bool(d.get("is_error")) or d.get("subtype") != "success"
sys.exit(0 if bad else 1)
PYEOF
}

LIMIT_RETRY_S=${LIMIT_RETRY_S:-240}      # how often to check again
LIMIT_MAX_TRIES=${LIMIT_MAX_TRIES:-360}  # give up after roughly a day of waiting
API_RETRY_S=${API_RETRY_S:-90}           # a 5xx usually clears in a minute or two

# CUR is always the log of the most recent run. Everything below reads it rather than $LOG,
# because after the first nudge $LOG is stale and a limit hit in a *resumed* session would
# otherwise go unnoticed.
CUR="$LOG"
MINS=$(python3 -c "import json;print(round(json.load(open('$CUR')).get('duration_ms',0)/60000))" 2>/dev/null || echo 999)
read_state() {
  MINS=$(python3 -c "import json;print(round(json.load(open('$CUR')).get('duration_ms',0)/60000))" 2>/dev/null || echo 999)
  S2=$(field "$CUR" session_id); [ -n "$S2" ] && { SID="$S2"; echo "$SID" > "$LAST_ID"; }
}

# Sit out anything that is not the agent choosing to stop: a usage limit, or a transient API
# failure. Neither costs a nudge.
wait_out_transient() {
  local tries=0 why
  while [ "$tries" -lt "$LIMIT_MAX_TRIES" ]; do
    if   hit_limit "$CUR"; then why=limit
    elif api_error "$CUR"; then why=api
    else break
    fi
    tries=$((tries + 1))
    if [ "$why" = limit ]; then
      echo "  usage limit still in force - waiting ${LIMIT_RETRY_S}s then trying again (attempt $tries)"
      sleep "$LIMIT_RETRY_S"
    else
      echo "  session did not end cleanly (transient) - waiting ${API_RETRY_S}s then retrying (attempt $tries, no nudge spent)"
      sleep "$API_RETRY_S"
    fi
    boot_game >/dev/null 2>&1 || true
    agent_run "Continue where you left off. Nothing is waiting on a reply and nobody is coming." "$SID" | tee "$CUR"
    read_state
  done
  if [ "$tries" -gt 0 ] && ! hit_limit "$CUR" && ! api_error "$CUR"; then
    echo "  cleared after $tries attempt(s) - running again"
  fi
}

[ -n "${DRY_RUN:-}" ] || wait_out_transient
n=0
while [ -n "$SID" ] && [ "$n" -lt "$MAX_NUDGES" ] && [ -z "${DRY_RUN:-}" ]; do
  n=$((n+1))
  echo "  session ended cleanly at ${MINS}m → resuming $SID, nudge $n/$MAX_NUDGES"
  CUR="${LOG%.log}-resume$n.log"
  boot_game || echo "  (the dev server is still down — the agent will work offline, as instructed)"
  agent_run "You stopped, and nothing was asking you to. Nothing is waiting on a reply and \
nobody is coming — continue exactly where you left off, starting with whatever you had \
queued or listed as next. There is no finish line for this work and no session in which it \
is correct to hand over and stop; a handover note is for being cut off mid-thought, not for \
ending a session that could have kept going. If the dev server or the control surface is down, \
retry it periodically but keep working meanwhile on everything that doesn't need it: design \
documents, reference photographs, asset preparation, scripts to run when it returns. Append to \
PROGRESS.md as you go. Do not stop to ask, confirm, or wait — work until you are cut off." \
    "$SID" | tee "$CUR"
  read_state
  wait_out_transient
done

echo "done. screenshots: /tmp/aaabench_qa/  references: /tmp/aaabench_refs/  notes: $ROOT/PROGRESS.md"
