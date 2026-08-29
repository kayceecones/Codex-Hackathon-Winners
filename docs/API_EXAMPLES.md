# API Examples

Start the backend:

```powershell
npm.cmd install
npm.cmd run dev
```

Base URL:

```text
http://localhost:3001
```

## Quick Checks

```powershell
curl.exe http://localhost:3001/
curl.exe http://localhost:3001/health
curl.exe http://localhost:3001/api/contracts
```

## Full Demo Flow

Run these commands in PowerShell. The first command stores the generated project id in `$projectId`, so the rest of the commands can be pasted without manually replacing placeholders.

### 1. Create A Project

```powershell
$created = Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/projects" -ContentType "application/json" -Body '{"name":"Codex Hackathon Winners Demo","description":"Agentic project operating system demo","leader":"Leader"}'
$projectId = $created.snapshot.project.id
$projectId
```

### 2. Send Accepted Proposal

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "proposal.accepted"
  projectId = $projectId
  actor = @{ name = "Person A"; role = "team_member" }
  payload = @{
    proposal = @{
      title = "Add dark mode"
      summary = "Frontend-only dark mode with persistence."
      proposer = "Person A"
      acceptanceCriteria = @("Theme can be toggled", "Preference persists")
    }
  }
} | ConvertTo-Json -Depth 8)
```

### 3. Submit Plan V2

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "planning.completed"
  projectId = $projectId
  actor = @{ name = "Planning Agent"; role = "planning" }
  payload = @{
    plan = @{
      title = "Plan v2: dark mode"
      summary = "Add theme tokens, toggle UI, and persistence."
      steps = @(@{ title = "Add theme tokens"; description = "Create light and dark theme variables."; owner = "Person 4" })
      acceptanceCriteria = @("Theme persists across reloads")
    }
  }
} | ConvertTo-Json -Depth 8)
```

### 4. Request Changes

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "leader.requested_changes"
  projectId = $projectId
  actor = @{ name = "Leader"; role = "leader" }
  payload = @{
    leader = "Leader"
    feedback = "Keep this frontend-only and include local persistence."
  }
} | ConvertTo-Json -Depth 8)
```

### 5. Submit Plan V3

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "planning.completed"
  projectId = $projectId
  actor = @{ name = "Planning Agent"; role = "planning" }
  payload = @{
    plan = @{
      title = "Plan v3: frontend-only dark mode"
      summary = "Add frontend theme tokens, toggle, and local storage."
      feedbackAddressed = "Removed backend work."
      steps = @(@{ title = "Add toggle"; description = "Expose a theme toggle in the dashboard."; owner = "Person 4" })
      acceptanceCriteria = @("No backend call is required", "Theme persists across reloads")
    }
  }
} | ConvertTo-Json -Depth 8)
```

### 6. Approve Current Plan

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "leader.approved"
  projectId = $projectId
  actor = @{ name = "Leader"; role = "leader" }
  payload = @{ leader = "Leader"; notes = "Approved." }
} | ConvertTo-Json -Depth 8)
```

### 7. Complete Coding

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "coding.completed"
  projectId = $projectId
  actor = @{ name = "Coding Agent"; role = "coding" }
  payload = @{
    execution = @{
      status = "completed"
      summary = "Implemented approved plan."
      filesChanged = @("src/frontend/theme.ts")
      commandsRun = @("npm.cmd run test")
    }
  }
} | ConvertTo-Json -Depth 8)
```

### 8. Submit Review Issue

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "review.completed"
  projectId = $projectId
  actor = @{ name = "Review Agent"; role = "review" }
  payload = @{
    review = @{
      classification = "coding_issue"
      summary = "One visual issue remains."
      issues = @(@{ title = "Low contrast badge"; detail = "Held badge is hard to read."; severity = "medium" })
    }
  }
} | ConvertTo-Json -Depth 8)
```

### 9. Complete Coding Fix

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "coding.completed"
  projectId = $projectId
  actor = @{ name = "Coding Agent"; role = "coding" }
  payload = @{
    execution = @{
      status = "completed"
      summary = "Fixed review issue."
      filesChanged = @("src/frontend/theme.ts")
      commandsRun = @("npm.cmd run test")
    }
  }
} | ConvertTo-Json -Depth 8)
```

### 10. Complete Final Review Pass

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "review.completed"
  projectId = $projectId
  actor = @{ name = "Review Agent"; role = "review" }
  payload = @{
    review = @{
      classification = "pass"
      summary = "Acceptance criteria passed."
    }
  }
} | ConvertTo-Json -Depth 8)
```

## Read State, Timeline, And Actions

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/projects/$projectId" | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "http://localhost:3001/api/projects/$projectId/events" | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "http://localhost:3001/api/projects/$projectId/next-actions" | ConvertTo-Json -Depth 10
```

## Hold, Resume, And Exit Examples

Hold an active workflow:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "leader.held"
  projectId = $projectId
  payload = @{ leader = "Leader"; reason = "Waiting for stakeholder confirmation." }
} | ConvertTo-Json -Depth 8)
```

Resume a held workflow:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "workflow.resumed"
  projectId = $projectId
  payload = @{ note = "Ready to continue." }
} | ConvertTo-Json -Depth 8)
```

Exit an active workflow:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/events" -ContentType "application/json" -Body (@{
  type = "leader.exited"
  projectId = $projectId
  payload = @{ leader = "Leader"; reason = "Out of hackathon scope." }
} | ConvertTo-Json -Depth 8)
```
