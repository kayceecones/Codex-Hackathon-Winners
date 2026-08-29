# Runloop Expansion Plan — Beyond "A Place To Run Code"

**Status:** Ideas 1 and 2 are built and typechecked. Milestone 0 is written as a
runnable script (`npm run milestone0`) but **has not been run** — no
`RUNLOOP_API_KEY` exists yet, so no Runloop call in this repo has ever hit the
real API. Idea 3 remains a proposal needing Person 1 + Person 3 buy-in.

Verified locally without a key: the injected preview server serves the demo app
correctly (content types, 404s, traversal blocked), and the new `/devboxes` and
`/cleanup` endpoints respond. Everything touching Runloop itself is unexercised
until Milestone 0 runs.

## The problem with what we have now

Today Runloop is a stateless code-runner: create a box, dump three files in, let the LLM edit them, run one script, throw the box away. Every run starts from the same blank slate, and the only thing that survives is a JSON blob saying "2 passed, 0 failed."

That's the shallow read of Runloop. It's an isolated computer we rent for 30 seconds.

**The deeper read:** Runloop's snapshot API takes a `name`, a `commit_message`, and arbitrary `metadata`, and you can boot a brand-new devbox *from* a snapshot (`create({ snapshot_id })`). That is a git-shaped versioned filesystem. Our stated long-term vision in `PLAN.md` is:

```
Logical reasoning branches → Actual Git branches → Isolated Runloop environments
→ Agent-to-agent collaboration → Pull-request-style review → Human merge
```

Runloop already provides the substrate for the middle three. We're just not using it. The gap between "Weave is a chat UI that calls a sandbox" and "Weave is GitHub for group reasoning" is mostly this file.

## Verified capabilities (checked against `@runloop/api-client` v1.31.0)

Confirmed present in the installed SDK's type definitions:

| Capability | API | Note |
|---|---|---|
| Boot from a snapshot | `devboxes.create({ snapshot_id })` | Only one of snapshot_id / blueprint_id / blueprint_name |
| Snapshot with a commit message | `devboxes.snapshotDisk(id, { name, commit_message, metadata })` | Returns `DevboxSnapshotView` with `source_devbox_id` |
| Async snapshot | `devboxes.snapshotDiskAsync` + `diskSnapshots.awaitCompleted` | Snapshotting is **not** instant |
| Public HTTP tunnel | `devboxes.enableTunnel(id, { auth_mode: 'open', wake_on_http })` | Returns `tunnel_key` |
| Suspend / resume | `devboxes.suspend(id)` / `devboxes.resume(id)` | Plus `keepAlive(id)` |
| Async execution | `devboxes.executeAsync` + `waitForCommand` | For streaming progress |
| Terminal access | `devboxes.createPtyTunnel(id)` | Ephemeral, authenticated |
| Prebuilt environments | `blueprints.createAndAwaitBuildCompleted()` | Faster, deterministic cold start |
| Snapshot listing/history | `devboxes.listDiskSnapshots()` / `diskSnapshots.list()` | Paginated |

**Tunnel URL gotcha:** there is no `port` parameter. `enableTunnel` accepts only `auth_mode`, `http_keep_alive`, and `wake_on_http`. You build the URL yourself from the returned key:

```
https://{port}-{tunnel_key}.tunnel.runloop.ai
```

One tunnel per devbox, and any port is reachable through its own URL prefix.

---

## Milestone 0 — Prove the base path works for real (blocks everything below)

**Not one Runloop call in this repo has ever run against a real API key.** Everything so far is typechecked and structurally correct, but unexercised. Stacking tunnels and snapshot chains onto an unverified base is how a demo dies at 3:50.

Before any item below, one run must succeed end to end with a real `RUNLOOP_API_KEY`:

```
create → awaitRunning → writeFile → exec → shutdown
```

Everything below is gated on this. It is cheap — one script, a few minutes — and it either de-risks the whole plan or tells us something important early.

---

## Idea 1 — Live preview URL (the demo's missing piece)

**Why this is first:** the demo script's step 8 is literally *"Result: Show the actual working application."* We cannot do that today. We show text. This isn't a new feature — it's a hole in a script we already committed to.

**What it does:** after the coding agent finishes, the devbox serves the demo app over HTTP through a public Runloop tunnel. The execution result carries a real URL. Person 4's frontend renders it as a link or an iframe. Everyone on the team clicks the same link and sees the same running app, dark mode and all.

That's the multiplayer thesis made physical: not a screenshot one person took, but one live environment the whole team is looking at.

**How:**
1. Write a ~10-line static file server into the devbox (`server.js`) and start it with `executeAsync` on a fixed port (8000). Use **node**, not `python3 -m http.server` — we know node exists in the box because we already run `node demo-app/verify.js`; python is unverified.
2. `enableTunnel(id, { auth_mode: 'open', wake_on_http: true })`.
3. Construct `https://8000-{tunnel_key}.tunnel.runloop.ai` and put it on the `coding.completed` event as `preview_url`.

**The collision this creates — and it's the real work:** `server.ts` currently calls `devbox.shutdown()` in a `finally` block, unconditionally. A preview URL pointing at a destroyed devbox is worthless. So this requires changing the lifecycle:

- **On success:** `suspend()` instead of `shutdown()`, with `wake_on_http: true` so clicking the preview link resumes the box on demand.
- **On failure:** still `shutdown()` immediately — nothing worth previewing.
- **Explicit cleanup path:** a suspended devbox still consumes quota. Needs a `POST /cleanup` endpoint (shut down every devbox this service started) and a hard cap on how many stay suspended. **Leaking devboxes through a 4-hour hackathon is a real cost risk** — this isn't optional hygiene, it's part of the feature.

This absorbs what was going to be a separate "pre-warming" item: suspend/resume is the same machinery.

**Free bonus:** once something is actually serving HTTP, `verify.js` can stop regex-matching source files and start doing real `fetch`-and-assert against the rendered page. Our "the tests are real" claim gets meaningfully stronger for almost no extra work.

**Effort:** medium. The tunnel call is trivial; the lifecycle rework and cleanup discipline are the substance.

---

## Idea 2 — Snapshots as commits: the project actually accumulates

**Why this matters:** right now every execution starts from the same three pristine seed files. Add dark mode, throw it away. Add mobile responsiveness, start over from scratch — the dark mode is *gone*. The project never grows. Our "shared project memory" story is Notion prose describing changes that no longer exist anywhere.

With snapshots, the project becomes a real chain of environments:

```
seed  ──►  plan-v3 snapshot  ──►  plan-v4 snapshot  ──►  plan-v5 snapshot
           "add dark mode"       "mobile responsive"    "fix contrast"
              (bootable)            (bootable)            (bootable)
```

Every approved execution is a commit with a message. Every plan version has a *running environment* you can boot and look at. "Why did we make this change" gets an answer you can click, not just read.

**Split this into what ships now and what waits:**

**2a — Emit the snapshot (entirely mine, no dependencies):**
After a successful run, `snapshotDiskAsync(id, { name: 'plan-v5', commit_message: <plan summary>, metadata: { plan_version, execution_contract_id } })`, then include `snapshot_id` on the `coding.completed` event. Person 2's memory layer stores it against the plan version. Snapshotting isn't instant, so **don't block the HTTP response on it** — kick it off, return, and emit a follow-up event when `awaitCompleted` resolves.

**2b — Chain from it (needs Person 1 + Person 2):**
Accept an optional `base_snapshot_id` on the execution contract. When present, `create({ snapshot_id: base_snapshot_id })` instead of seeding from scratch. When absent, seed exactly as today.

That's the same graceful-no-op pattern already used for `files_or_areas`: the feature works when the contract carries the field, and degrades silently to current behavior when it doesn't. So 2a can ship today and 2b lights up the moment Person 1 round-trips one extra string.

**Tradeoff to design around honestly:** chaining gives up the "every run starts from a known-good seed" property that makes the demo reliable. If plan-v4's snapshot is subtly broken, every later run inherits the breakage. Keep an explicit **reset-to-seed** path (ignore `base_snapshot_id`) as a demo escape hatch.

**Effort:** 2a is low. 2b is low on my side, but gated on the contract.

---

## Idea 3 — Reasoning branches as parallel devboxes (direction, not solo work)

The pitch is seductive: Maya's dark mode and James's mobile-responsive each boot their own devbox from the same base snapshot, run simultaneously, and produce two live preview URLs the team compares side by side before picking one. That is exactly "logical reasoning branches → isolated Runloop environments" from the future-architecture section, and Runloop supports it trivially — it's `Promise.all` over the path Idea 1 and 2 already build.

**But it contradicts two things the team has already decided, so I'm not scoping it as work I can just do:**

1. `BUILD_CONTRACT.md` says new requests *queue and do not interrupt current execution*. Parallel execution is a different concurrency model.
2. Person 3's Planning Agent — already merged into master — is built to **reconcile** multiple proposals into one coherent plan (`v4 + both proposals = v5`), explicitly *not* to fork them into competing branches. Running two devboxes for two proposals contradicts the core behavior of the planning layer.

So this belongs in the plan as a **described direction needing Person 1 and Person 3 buy-in**, not as a task. It's the most thesis-aligned idea here and the most likely to break the demo if bolted on unilaterally at hour three.

---

## Further options (lower priority, listed for completeness)

- **Live execution streaming** — `executeAsync` + log polling to stream the agent's work to the frontend as it happens, instead of a 30-second black box. Directly serves the YC framing ("drop into the same live agent session to watch it work"). Needs Person 4 coordination.
- **PTY tunnel** — `createPtyTunnel` gives real terminal access into a run. Very compelling, needs a terminal emulator in the UI. Probably out of scope.
- **Blueprints** — pre-bake the base environment for faster, more deterministic cold starts. Largely overlapping with what snapshots already give us; revisit only if boot latency actually hurts.

---

## Recommended order

| # | Item | Depends on | Effort |
|---|---|---|---|
| 0 | One real Runloop round-trip with a live key | `RUNLOOP_API_KEY` | Trivial |
| 1 | Live preview URL + suspend-not-shutdown lifecycle + cleanup | Milestone 0 | Medium |
| 2 | Real HTTP-based `verify.js` assertions | Idea 1 | Low |
| 3 | Emit snapshot id on completion (2a) | Milestone 0 | Low |
| 4 | Boot from `base_snapshot_id` when provided (2b) | Person 1 contract | Low |
| 5 | Parallel branch devboxes | Person 1 + Person 3 buy-in | Medium |

**If we only do two things: Milestone 0 and Idea 1.** A live URL the whole team can open turns the demo's weakest moment — "trust us, it worked" — into its strongest.

## Open questions

1. **Do we have a real `RUNLOOP_API_KEY` yet?** Everything is gated on this.
2. **Person 1:** can the execution contract carry an optional `base_snapshot_id`, and can `coding.completed` carry `preview_url` + `snapshot_id`?
3. **Person 2:** where does a snapshot id live in the memory schema — on the plan version record?
4. **Person 4:** iframe or plain link for the preview URL? (`auth_mode: 'open'` is required either way — an authenticated tunnel needs an `X-Runloop-Tunnel-Authorization` header that a plain iframe can't send.)
5. **Team:** how many suspended devboxes are we willing to leave running during the demo, and who runs cleanup?
