# Project Setup

This branch contains the Person 1 Master backend plus the latest merged Person 3 and Person 5 work.

## Structure

```text
/
  src/                    Person 1 Master backend API
  tests/                  Person 1 backend tests
  docs/                   Shared setup and integration handoff docs
  ResearchAndCoding/      Person 3 Brainstorm + Planning package
  coding-review-agent/    Person 5 Coding + Runloop + Review package
```

## Requirements

- Node.js 20 or newer
- npm
- PowerShell on Windows

Use `npm.cmd` in PowerShell if plain `npm` is blocked by script execution policy.

## Install Everything

From the repo root:

```powershell
npm.cmd run install:all
```

Equivalent manual commands:

```powershell
npm.cmd install
npm.cmd --prefix ResearchAndCoding install
npm.cmd --prefix coding-review-agent install
```

Generated folders are ignored by Git:

- `node_modules/`
- `dist/`
- `coverage/`
- `.env`
- `.env.*`, except `.env.example`

## Run Person 1 Master Backend

```powershell
npm.cmd run dev:master
```

Default URL:

```text
http://127.0.0.1:3001
```

Useful checks:

```powershell
curl.exe http://127.0.0.1:3001/
curl.exe http://127.0.0.1:3001/health
curl.exe http://127.0.0.1:3001/api/contracts
```

## Run Person 3 Workflow Check

```powershell
npm.cmd run demo:person3
npm.cmd run test:person3
```

Person 3 can integrate with Master in either of these ways:

- Send canonical Master events directly to `POST /api/events`.
- Send Person 3 output events to `POST /api/integrations/person3/events`; Master maps `person3.plan_version_ready` into `proposal.accepted` and `planning.completed`.

## Run Person 5 Service

Install Person 5 dependencies first, then configure environment values in `coding-review-agent/.env`:

```text
RUNLOOP_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
PORT=4005
MASTER_API_URL=http://127.0.0.1:3001
```

Start Person 5:

```powershell
npm.cmd run dev:person5
```

Person 5 should consume `nextActions[].payload.codingReviewContract` from Master and send it to:

```text
POST http://127.0.0.1:4005/execution-contract
```

When `MASTER_API_URL` is set, Person 5 posts `coding.completed` and `review.completed` back to Master automatically.

## Verify Before Merge

From the repo root:

```powershell
npm.cmd run test:person1
npm.cmd run test:person3
npm.cmd run typecheck:person5
npm.cmd run build
npm.cmd run demo
```

Combined check:

```powershell
npm.cmd run test:all
npm.cmd run build:all
```

Expected result:

- Person 1 tests pass.
- Person 3 tests pass.
- Person 5 TypeScript check passes.
- Person 1 build succeeds.
- Integrated flow ends with `finalStatus` set to `completed`.

## Handoff Docs

- `docs/PERSON_1_INTEGRATION.md`: full teammate integration guide.
- `docs/FRONTEND_ENDPOINTS.md`: endpoint reference for Person 4.
- `docs/MEMORY_ADAPTER.md`: persistence adapter handoff for Person 2.
- `docs/API_EXAMPLES.md`: copy-pasteable API walkthrough.

## Important Runtime Note

Person 1 currently uses in-memory state. Projects disappear when the Master server restarts. That is intentional for this branch so Person 2 can plug in the real database/Notion store by implementing `src/adapters/store/Store.ts`.