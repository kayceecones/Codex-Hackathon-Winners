# Person 1 Backend Setup

This is the Master Agent backend for Person 1. It provides the orchestration API, workflow state machine, teammate contracts, in-memory demo store, and agent handoff queue.

## Requirements

- Node.js 20 or newer
- npm
- PowerShell on Windows

On this Windows setup, use `npm.cmd` instead of `npm` because PowerShell may block `npm.ps1` scripts.

## Install

```powershell
npm.cmd install
```

Generated folders are intentionally ignored by Git:

- `node_modules/`
- `dist/`
- `coverage/`

## Run The Backend

```powershell
npm.cmd run dev
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

## Verify Before Integration

```powershell
npm.cmd run test
npm.cmd run build
npm.cmd run demo
```

Expected result:

- Tests pass.
- TypeScript build succeeds.
- Demo ends with `finalStatus` set to `completed`.

## Integration Files

- `docs/PERSON_1_INTEGRATION.md`: what each teammate should send, consume, or replace.
- `docs/API_EXAMPLES.md`: copy-pasteable PowerShell workflow using a real generated project id.
- `src/contracts/index.ts`: TypeScript export surface for shared integration types.
- `src/master/stateMachine.ts`: pure workflow transition logic.
- `src/adapters/store/Store.ts`: interface Person 2 can implement with the real database/Notion layer.

## Important Runtime Note

This MVP uses in-memory state. Projects disappear when the server restarts. That is intentional for Person 1 so Person 2 can plug in the real persistence adapter later without changing API routes or Master logic.
