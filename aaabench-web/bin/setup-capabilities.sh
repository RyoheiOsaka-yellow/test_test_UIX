#!/usr/bin/env bash
# Give the agent maximum capability. Idempotent — safe to re-run.
#
#   ./bin/setup-capabilities.sh
#
# Four things happen here:
#   1. harness dependencies (the browser that gives the agent eyes, the MCP server that hands
#      them over)
#   2. the project skeleton is turned into a working project with its own dependencies
#   3. a Chromium that can actually rasterise WebGL is located and recorded
#   4. the machine is calibrated: what an empty stage costs here, so the frame budget can be
#      "twice the empty stage" instead of a frame rate that means nothing on this hardware
set -uo pipefail
cd "$(dirname "$0")/.."   # anchor at the repo root
ROOT="$PWD"
PROJECT="${1:-$ROOT/AgentCity}"

echo "== harness dependencies"
npm install --no-audit --no-fund --silent || { echo "npm install failed in $ROOT"; exit 1; }

echo
echo "== the project"
if [ ! -d "$PROJECT" ]; then
  cp -R "$ROOT/project" "$PROJECT"
  echo "  created $PROJECT from the skeleton"
else
  echo "  $PROJECT exists — left alone (the agent's work lives there)"
fi
( cd "$PROJECT" && npm install --no-audit --no-fund --silent ) || { echo "npm install failed in $PROJECT"; exit 1; }

echo
echo "== a browser that can rasterise"
# Playwright finds its browser by build number, so a Chromium installed for a different
# Playwright version is invisible to it: executablePath() returns a path that does not exist and
# launch() tells you to run `playwright install`, which is wrong when a perfectly good browser is
# already on disk. Observed on this machine (playwright wanted chromium-1234; /opt/pw-browsers had
# chromium-1194). tools/lib/browser.mjs searches instead of trusting the resolver.
CHROMIUM="$(node -e 'import("./tools/lib/browser.mjs").then(m=>console.log(m.resolveChromium())).catch(e=>{console.error(String(e));process.exit(1)})' 2>&1)" || {
  echo "  no Chromium found:"
  echo "$CHROMIUM" | sed 's/^/    /'
  echo "  install one (npx playwright install chromium) or set AAABENCH_CHROMIUM."
  exit 1
}
echo "  $CHROMIUM"
node -e '
import("./tools/lib/browser.mjs").then(async (m) => {
  const b = await m.launchBrowser(); const p = await b.newPage();
  await p.setContent("<canvas id=c></canvas><script>const g=document.getElementById(\"c\").getContext(\"webgl2\");window.__v=g?g.getParameter(g.VERSION):null;<\/script>");
  console.log("  " + (await p.evaluate(() => window.__v) || "NO WEBGL — the agent will have no eyes"));
  await b.close();
})' || exit 1

echo
echo "== python side tools"
python3 - <<'PY'
import shutil, sys
print(f"  python3: {sys.version.split()[0]}")
print(f"  imagemagick: {'yes' if shutil.which('magick') or shutil.which('compare') else 'no (image diffs fall back to byte sizes)'}")
PY
python3 tools/refs.py find "harbour crane" --n 1 >/dev/null 2>&1 \
  && echo "  reference photographs: reachable (Openverse)" \
  || echo "  reference photographs: NOT reachable from this host — note it in the run log; the demand assumes the agent can go and look"

echo
echo "== MCP config"
cat > "$ROOT/.mcp.json" <<JSON
{
  "mcpServers": {
    "agentcity": {
      "command": "node",
      "args": ["$ROOT/mcp/server.mjs"],
      "env": { "AAABENCH_PORT": "${AAABENCH_PORT:-5173}" }
    }
  }
}
JSON
echo "  wrote $ROOT/.mcp.json"

echo
echo "== calibration"
# The frame budget is relative to what this machine can do with nothing on screen. Measuring it
# needs the game running, so boot the dev server, take the measurement, and put it back down.
PORT="${AAABENCH_PORT:-5173}"
if curl -s -m 2 -o /dev/null "http://127.0.0.1:$PORT/"; then
  echo "  something is already serving :$PORT — calibrating against that"
  node tools/qa.mjs calibrate >/dev/null && echo "  $(node -e 'const b=require("./.harness-baseline.json");console.log(`empty stage: ${b.fps} fps at ${b.size.w}x${b.size.h}`)')"
else
  ( cd "$PROJECT" && AAABENCH_PORT="$PORT" npm run dev >/tmp/aaabench-calibrate.log 2>&1 & echo $! > /tmp/aaabench-calibrate.pid )
  for _ in $(seq 1 40); do sleep 1; curl -s -m 2 -o /dev/null "http://127.0.0.1:$PORT/" && break; done
  if curl -s -m 2 -o /dev/null "http://127.0.0.1:$PORT/"; then
    node tools/qa.mjs calibrate >/dev/null 2>&1 \
      && echo "  $(node -e 'const b=require("./.harness-baseline.json");console.log(`empty stage: ${b.fps} fps at ${b.size.w}x${b.size.h}`)')" \
      || echo "  calibration failed — bin/health.sh will say why"
  else
    echo "  the dev server never came up; see /tmp/aaabench-calibrate.log"
  fi
  kill "$(cat /tmp/aaabench-calibrate.pid 2>/dev/null)" 2>/dev/null
  rm -f /tmp/aaabench-calibrate.pid
fi

echo
echo "next: bin/run-agent.sh   (boots the game, hands over the demand, keeps it going)"
