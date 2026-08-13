# Setup

```bash
git clone <this repo> && cd aaabench-web
./bin/setup-capabilities.sh     # deps, project, browser, calibration
./bin/prep-project.sh           # verify the sensors answer before a run starts
./bin/run-agent.sh              # boots the game, hands over the demand, keeps it going
```

## What each step does

**`setup-capabilities.sh`** installs the harness dependencies, copies `project/` to `AgentCity/`
(only if it does not already exist — the agent's work is never overwritten), installs the
project's own dependencies, locates a Chromium that can rasterise WebGL2, writes `.mcp.json`, and
calibrates: it boots the empty stage and measures what a frame costs on this machine, into
`.harness-baseline.json`. That baseline is what makes the frame budget meaningful on a host with
no GPU.

**`prep-project.sh`** boots the dev server, checks the control surface can see the page, and takes
one capture through the same tool the agent uses. A run that starts against a broken sensor chain
produces hours of confident work nobody can see.

**`run-agent.sh`** is the run. It:

- refuses to start a second runner (two agents on one working tree interleave their edits);
- boots the dev server and waits for it;
- reports whether the page renders — and if it does not, starts anyway, because a broken build is
  the agent's problem, not the harness's;
- hands over `PROMPT.md`, or resumes the previous session if there is one;
- resumes after every clean stop, up to `MAX_NUDGES`;
- sits out usage limits and transient API failures without spending a nudge.

## Environment

| variable | default | what it does |
|---|---|---|
| `AGENT` | `claude` | which CLI is under test (`claude`, `codex`, `gemini`, `custom`) |
| `MODEL` | `claude-opus-5` | pin the exact model id; a bare alias can move between sessions |
| `MAX_NUDGES` | 4 | resumes after a clean stop. 20 ≈ a day unattended |
| `AAABENCH_PORT` | 5173 | the dev server port |
| `FRESH` | — | force a cold start instead of resuming |
| `NOTE` | — | a file prepended to the demand on a cold start |
| `RESUME_NOTE` | — | a one-off instruction prepended to a resume |
| `DRY_RUN` | — | boot everything, run no agent — for checking the harness |
| `SKIP_PROBE` | — | skip the sensor check at boot (saves ~10 s) |
| `AAABENCH_CHROMIUM` | — | override browser discovery |
| `ALLOW_ROOT` | — | in a container running as root: sets `IS_SANDBOX=1` so the agent CLI accepts `--dangerously-skip-permissions` |

Running as root is the normal case in a container and the abnormal case everywhere else. Claude
Code refuses to skip permission prompts as root, and the refusal reads like a bad flag rather than
a policy, so `run-agent.sh` says so explicitly and leaves the override to you. Do not set
`ALLOW_ROOT` on a machine you care about.

Keys in `keys.env` or `~/.aaabench-keys.env` are loaded into the session environment, so the agent
discovers them as capabilities rather than being told they exist. Both are gitignored.

## Running it unattended

```bash
nohup bin/supervise.sh >/dev/null 2>&1 &   # keeps exactly one runner alive, forever
watch -n 300 ./bin/health.sh               # or just run it when you wonder
./bin/health.sh --deep                     # also checks the page still renders
./bin/restart-agent.sh RESUME-NOTE.md      # restart by hand without racing the supervisor
./bin/run-many.sh 6                        # six COLD sessions — the continuity test
```

`supervise.sh` and `run-many.sh` measure different things. The supervisor resumes one conversation
across a long run: that is endurance. `run-many.sh` starts each session cold, so the agent has
only what it wrote down: that is continuity. Both are worth running; say which one produced a
result.

## Cleaning up between runs

The agent's work is `AgentCity/`, `PROGRESS.md`, and its commits. To start a genuinely fresh run:

```bash
rm -rf AgentCity PROGRESS.md .last-session-id session-*.log /tmp/aaabench_qa/*
./bin/setup-capabilities.sh
```

Keep the old run somewhere first if you intend to compare — a run you deleted is a result you
cannot check.
