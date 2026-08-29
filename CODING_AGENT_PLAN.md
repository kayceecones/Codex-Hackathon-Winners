# Coding + Runloop + Review — Implementation Plan (Person 5)

Owner: me. Role recap from `BUILD_CONTRACT.md` (revised architecture): Coding Agent, Runloop integration, execution contract, repository operations and test execution, Review Agent, review classification (pass / coding issue / plan issue), feedback events back to the Master Agent.

**Change from the previous architecture:** this role now also owns Review (previously bundled with Memory/Demo Reliability). Persistence (Notion + database) is a separate role (Person 2) — this service emits events/results rather than writing to Notion/DB directly (see §7, flagged for confirmation).

## 1. Goal

A service that:

1. Receives an **execution contract** from the Master Agent once the leader approves a plan.
2. Runs a Coding Agent inside a Runloop devbox to implement it against the demo app.
3. Runs a Review Agent against the result, classifying it `pass`, `coding issue`, or `plan issue`.
4. Emits events back to the Master Agent so it can route: pass → complete/persist; coding issue → back to Coding; plan issue → back to Planning.

This service does not own the state machine, approvals, or persistence — it's the execution + validation stage the Master invokes and gets events back from.

## 2. Tech stack

| Concern | Choice | Why |
| --- | --- | --- |
| Language/runtime | Node.js + TypeScript | Matches Runloop's official coding-agent reference example, which maps directly to the SDK calls below. |
| Sandbox | Runloop Devboxes via `@runloop/api-client` (v1.31.0) | Purpose-built microVM sandboxes for AI coding agents. |
| Coding LLM | OpenAI (`openai` npm package, v7.8.0), Responses API tool-calling loop | Team decision: building around OpenAI, not Claude. |
| Review | Deterministic checks first, LLM-as-judge as a stretch goal | Reliability over sophistication for a 4-hour build; see §6. |
| Interface to Master | HTTP endpoint(s) *or* event subscription — **to confirm with Person 1** | New architecture is event-routed, not a flat REST contract; need Person 1's actual transport (HTTP call with callback, message queue, or direct function call in-process). |

**Status: implemented.** `coding-review-agent/` on branch `sahil/coding-runloop-review` has a working, typechecked skeleton — Runloop devbox wrapper, OpenAI tool-calling coding agent, deterministic review classifier, Express server wiring them together, seed demo app, and two verify scripts (dark-mode, mobile-responsive). Not yet tested against real `RUNLOOP_API_KEY`/`OPENAI_API_KEY` — only a `/health` smoke test so far.

## 3. Runloop integration (grounded in the real SDK)

Confirmed from Runloop's own `coding-agent/typescript` example:

```ts
import Runloop from '@runloop/api-client';
const runloop = new Runloop({ bearerToken: process.env.RUNLOOP_API_KEY });

const devbox = await runloop.devboxes.create();
await runloop.devboxes.awaitRunning(devbox.id);

await runloop.devboxes.executeSync(devbox.id, { command: 'ls demo-app' });
await runloop.devboxes.readFileContents(devbox.id, { file_path: 'demo-app/index.html' });
await runloop.devboxes.writeFileContents(devbox.id, { file_path: 'demo-app/index.html', contents: '<...>' });

await runloop.devboxes.shutdown(devbox.id);
```

Always `shutdown()` in a `finally` block — leaked devboxes burn quota during the hackathon.

### Getting the demo repo into the devbox

Go with **A** for the hackathon; keep **B** as a stretch goal:

- **A — Write files directly.** On devbox creation, `writeFileContents()` the demo app's files from a local copy this service ships with. No git, no auth, no network flakiness during the demo. Read them back afterward to diff.
- **B — Git clone.** `executeSync('git clone <repo>')` if the demo app ends up in its own pushed repo.

### Pre-warming (new — added for the live-demo risk noted in the new plan's timing)

Since the leader can now go through multiple **Request Updated Plan** cycles before approving, create the devbox as soon as it's clear coding is imminent (e.g., right after Approval #1 on what looks like the final round) rather than waiting for the final approval event, to hide devbox cold-start latency during the live demo. Exact trigger point to confirm with Person 1 once the event stream is defined.

## 4. Coding agent loop

1. System prompt: "You are editing a small customer-support dashboard demo app. Files: index.html, style.css, app.js. Implement the given tasks. Keep changes minimal and scoped to the request. When finished, call `done`."
2. Tools exposed to the LLM:
   - `read_file(file_path)` → `readFileContents`
   - `write_file(file_path, contents)` → `writeFileContents`
   - `run_command(command)` → `executeSync`
   - `done(summary)` → ends the loop
3. Loop up to a fixed iteration cap (e.g. 10), same pattern as the Runloop reference example.
4. Hard cap + timeout: if the cap is hit without `done`, treat as a failed coding run and let Review classify it as a coding issue rather than hanging the demo.

## 5. Test strategy (feeds Review, §6)

The demo app is static HTML/CSS/JS with no existing test runner, so "tests" are lightweight scripted assertions:

- Ship a small `verify.js` per known request type (`dark-mode`, `mobile-responsive`) written into the devbox alongside the source files. Example: dark-mode's script checks `style.css` for a `[data-theme="dark"]`/`.dark` rule and `app.js` for a toggle handler.
- Run with `executeSync('node verify.js')`; parse stdout for `PASSED`/`FAILED` lines → `{passed, failed}` counts.

## 6. Review Agent (new in this revision)

Takes: the execution result (files changed, test counts, summary) + the **approved plan** (tasks, `files_or_areas`, constraints) + acceptance criteria (from Planning, format TBD with Person 3) → produces one of three outcomes.

**Classification logic, deterministic-first for reliability:**

- `tests.failed > 0` → **coding issue** (implementation didn't satisfy its own verify script).
- Files changed outside the plan's declared `files_or_areas`/constraints (e.g. touched something unrelated) → **coding issue** (scope violation) — this also satisfies the contract's old "unrelated-change check."
- Tests pass and scope matches, but the *plan itself* was under-specified or contradictory in a way execution exposed (e.g. plan said "add dark mode" with no persistence requirement, but acceptance criteria demand persistence and the plan never asked for it) → **plan issue**, routed back to Planning. For the hackathon, keep this path narrow and mostly scripted/mock-driven (per the original contract's allowance for deterministic/mock review) rather than a general LLM judge — it's the hardest to get reliable in 4 hours and only needs to fire once for the demo's recovery path.
- Otherwise → **pass**.

**Demo recovery path requirement:** the demo script needs one deliberate "Review finds a small UI issue → routes back to Coding → Coding fixes it → Review passes" cycle. Plan to either let this occur naturally (verify script catches a real gap) or make it reliably reproducible by seeding a task that predictably trips one check on the first pass (coordinate with Person 5... i.e. me... and Person 4 on what's demoable).

## 7. Events emitted back to the Master Agent

Proposed shapes (to confirm with Person 1 — these aren't fixed anywhere in the new plan yet, only named):

```json
{ "type": "coding.started", "execution_contract_id": "...", "devbox_id": "..." }
{ "type": "coding.completed", "execution_contract_id": "...", "status": "success|failed", "summary": "...", "files_changed": [], "tests": { "passed": 0, "failed": 0 } }
{ "type": "review.started", "execution_contract_id": "..." }
{ "type": "review.passed", "execution_contract_id": "..." }
{ "type": "review.issue", "execution_contract_id": "...", "classification": "coding|plan", "detail": "..." }
```

**Open question for Person 1:** does this service call an HTTP endpoint on the Master with these payloads, publish to a queue/pubsub, or run in-process as a function the Master calls and awaits? Whichever it is, the payload shapes above are what I'll produce — happy to adjust field names to match Person 1's/Person 2's schema once locked.

**Resolved:** this service emits events only (as implemented in `server.ts`'s `emitEvent`) — it never writes to Notion/DB directly. Person 2's Notion + database now exists; their adapter (or Master, off these events) is what persists execution/review results. Keeps this service stateless and focused.

## 8. Execution contract (input) — proposed shape

The new plan calls this an "execution contract" without pinning its fields. Proposed, extending the old plan's shape with acceptance criteria for Review to check against:

```json
{
  "execution_contract_id": "contract-123",
  "project_id": "demo-project",
  "plan_version": 5,
  "tasks": [],
  "files_or_areas": [],
  "constraints": [],
  "acceptance_criteria": [],
  "context": []
}
```

`files_or_areas` and `acceptance_criteria` are new vs. the old contract — needed so Review has something concrete to check scope and correctness against. To confirm with Person 3 (Planning) that these are fields their agent actually produces.

## 9. Proposed file structure

```
coding-review-agent/
  src/
    server.ts            # entrypoint — HTTP endpoint or event subscriber, per §7
    devbox.ts             # Runloop client wrapper (create/write/read/exec/shutdown)
    coding-agent.ts        # LLM tool-calling loop
    review-agent.ts         # classification logic (§6)
    verify/
      dark-mode.js
      mobile-responsive.js
    seed/
      index.html
      style.css
      app.js
  package.json
  tsconfig.json
  .env.example             # RUNLOOP_API_KEY, OPENAI_API_KEY, OPENAI_MODEL
```

## 10. Build milestones (mapped to the new phase timings)

- **Phase 0 (0:00–0:20):** align on execution-contract fields (§8), event payload shapes (§7), and transport (HTTP vs queue vs in-process) with Person 1; confirm acceptance-criteria format with Person 3; get `RUNLOOP_API_KEY` / `OPENAI_API_KEY` set.
- **Phase 1 (0:20–1:20):** Runloop devbox wrapper (create/write/read/exec/shutdown) working standalone; seed demo-app files committed; coding agent loop proven against a hardcoded task.
- **Phase 2 (1:20–2:20):** build the Review Agent's deterministic checks against mocked execution results (doesn't need the real Master yet); start wiring whatever transport Person 1 confirmed.
- **Phase 3 (2:20–3:15):** this is my primary integration window per the new schedule — real execution contract in, Coding → Runloop → real result, Review classifies it, real events out to Master. Get the dark-mode path working end-to-end, ugly is fine.
- **Phase 4 (3:15–3:40):** participate in the full golden-path run and the recovery-path run (review issue → back to coding → fix → pass) — this is explicitly one of the two required integration runs in the new plan.
- **Phase 5 (3:40–4:00):** freeze; pre-warm devbox timing; canned fallback result recorded in case live Runloop/LLM calls flake during judging (coordinate with Person 2 on where that fallback data lives, since Memory/demo-reliability isn't a standalone role anymore).

## 11. Environment / secrets needed

- `RUNLOOP_API_KEY`
- `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, defaults to `gpt-5.6`)
- Confirm both available before Phase 0 ends — the one dependency that can block this whole role if missing.

## 12. Risks and fallbacks

- **Runloop devbox cold-start latency** during the live demo → pre-warm as soon as coding looks imminent (§3).
- **Coding LLM loop doesn't converge in time** → hard iteration cap + timeout, classify as coding issue rather than hanging.
- **Review's "plan issue" path is genuinely hard to get right in 4 hours** → keep it narrow/mostly scripted (§6); the demo only needs it to fire once, reliably, not to generalize.
- **Runloop/LLM API flakiness during judging** → keep a recorded/canned successful result + one canned recovery-cycle result as fallback.

## 13. Definition of done

Approved plan → Coding → Runloop → Review → Master loop works end-to-end, matching whatever contract/event shapes get locked with Person 1, 2, and 3.

## Open questions for the team

1. **Person 1:** transport for execution contract in / events out — HTTP+callback, queue, or in-process call?
2. **Person 1 & 2:** final field names for the execution contract and the event payloads in §7/§8 — the ones here are proposals, not settled.
3. **Person 3:** what does `acceptance_criteria` actually look like coming out of Planning? Review's scope-check depends on it.
4. **Confirmed:** writing demo-app files directly into the devbox (no git) is fine for the hackathon.
5. **Confirmed:** this service emits events only — Person 2's Notion/DB adapter owns persistence, not this service.
