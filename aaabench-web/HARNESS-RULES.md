# Harness rules — for the operator, not the agent

The benchmark measures what the model does with good conditions. Every hint we give it is a
capability we can no longer claim to have measured. So the line is:

## We may (this is harness work)

- Provide the environment: the browser, the dev server, the control surface, the tools, disk,
  compute, credentials.
- Provide resources: handbook docs, skill packs, reference-image search, asset sources,
  catalogues of ideas. Breadth of available knowledge is a condition, not an answer.
- Provide the demand: the brief, the standards, the definition of failure ("uniform coverage is
  a failure", "it must not look like one company built it"). A spec is not a hint — it is what we
  are asking for. Saying *what good means* is legitimate; saying *what is wrong with its build*
  is not.
- Fix the harness: restart a dead session, restart a dev server that will not bind, unblock a
  port, repair a path that resolves to nothing, back the work up, keep the sensors working.
- Restart it and tell it that prior work stands and where the new standards are.
- Observe as much as we like, and write down everything we see.

## We must not (this is the agent's job)

- **Diagnose its bugs.** Not "the ground has no texture", not "the aerial is empty sky", not
  "every building in the north district is the same height", not "your draw calls are the
  instancing".
- **Name its errors or hand it the working API call.** It has a console, a scene inspector, an
  eval hook and a documentation shelf; using them is part of what is being measured.
- **Point at a specific broken thing** and ask it to fix that thing.
- **Edit its code, its assets, its plan or its documents.** Ever.
- Answer a question it asks. Nobody is coming; that is the premise.

The temptation is sharpest at the boundary between "the harness is broken" and "the build is
broken", and this port has its own version of that boundary. A useful test: **if the fix belongs
in `AgentCity/`, it is the agent's.** A dev server that will not start is ours. A dev server that
starts and serves a page that throws is theirs — including when the page is blank, including when
it has been blank for an hour, including when we can see exactly which line did it.

## Why this is strict

The interesting result is not "can this model build a city if told what is wrong with it" — it is
whether the model *notices*. Self-diagnosis is the capability; the city is only the evidence.

The sensors are built for noticing and against being told: `viewport_capture` reports whether the
frame is flat before it reports the file path, `perf_sample` reports the frame cost next to the
empty-stage baseline, `play` reports whether input moved anything at all. All of that is
instrumentation, available equally on every run, and none of it says what to do. Reading it is
the agent's job. If you find yourself paraphrasing a sensor reading into advice, stop and log it.

## Contamination log (keep one, and publish it)

Every run leaks something. A result without a contamination log is a result you cannot check, so
keep the log as you go rather than reconstructing it afterwards, and publish it alongside whatever
you claim.

Log an entry whenever any of these happens:

- **The model under test was not the model you meant.** A bare alias can resolve to a different
  generation between sessions. Pin the exact model id (`MODEL=` in `bin/run-agent.sh`), record the
  id the session actually reported, and exclude sessions that ran on something else.
- **A restart note carried diagnosis into the subject.** The failure mode is subtle: a note that
  explains *why* the last session died, or lists the errors it hit, has handed the agent findings
  it was supposed to produce. A restart note should say only that prior work stands and where the
  standards changed.
- **The demand was edited because of something you saw a run do.** Adding a requirement after
  observing a fault is legitimate — the brief should get better — but it is not blind authoring.
  Record that the requirement exists because of an observation, even when the text names nothing
  the agent built and prescribes no specific fix.
- **You answered a question the agent should have answered.** Any hint, working code, or
  "actually the problem is…" belongs here, however small it felt at the time.
- **You touched anything under `AgentCity/`.** Including reverting a commit, resolving a merge,
  deleting a file that was breaking the build, or "just" reformatting. Say what and why.
- **The harness changed mid-run.** A tool gained a capability, a budget moved, a doc was added.
  Note the time, because every measurement before and after it is from a different experiment.

## What to report alongside a result

- The exact model id and the agent CLI, from the session logs.
- The machine, and **whether the browser had a GPU**. This port runs on software rasterisation
  when there is none — frame cost is then reported relative to the empty-stage baseline in
  `.harness-baseline.json`, which is a real measurement of the world's cost but not a claim about
  a gaming PC. Publish the baseline file with the result.
- Session count, wall-clock hours, nudges spent, and how many sessions were cold starts
  (`bin/run-many.sh`) versus resumes (`bin/supervise.sh`) — continuity is a different measurement
  from endurance.
- The contamination log. Empty is a claim, not a default.
