import type { FastifyInstance } from "fastify";

export async function registerRootRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (_request, reply) => {
    return reply.type("text/html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Person 1 Master Backend</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f8fb;
        color: #16181d;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
      }
      main {
        width: min(880px, 100%);
        border: 1px solid #d8dce5;
        border-radius: 8px;
        background: #ffffff;
        padding: 28px;
        box-shadow: 0 12px 32px rgba(31, 41, 55, 0.08);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
        letter-spacing: 0;
      }
      p {
        margin: 0 0 18px;
        color: #4b5563;
        line-height: 1.55;
      }
      ul {
        display: grid;
        gap: 10px;
        margin: 0 0 18px;
        padding: 0;
        list-style: none;
      }
      a,
      .endpoint {
        display: block;
        border: 1px solid #e2e6ee;
        border-radius: 8px;
        padding: 12px 14px;
        background: #fbfcff;
      }
      a {
        color: #0f5fca;
        text-decoration: none;
      }
      a:hover {
        border-color: #9bbff3;
        background: #f1f6ff;
      }
      .endpoint {
        color: #374151;
      }
      code {
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        color: #0f5fca;
      }
      @media (prefers-color-scheme: dark) {
        :root { background: #111318; color: #f8fafc; }
        main { background: #191d24; border-color: #303642; box-shadow: none; }
        p { color: #cbd5e1; }
        a, .endpoint { background: #151922; border-color: #303642; }
        a { color: #8ec5ff; }
        a:hover { background: #1d2430; border-color: #4b668c; }
        .endpoint { color: #dbe4ef; }
        code { color: #8ec5ff; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Person 1 Master Backend</h1>
      <p>The orchestration API is running. Health and contracts are clickable. Project-specific routes need a real project id created with <code>POST /api/projects</code>.</p>
      <ul>
        <li><a href="/health"><code>GET /health</code> - service health</a></li>
        <li><a href="/api/contracts"><code>GET /api/contracts</code> - supported states, events, and actions</a></li>
        <li><span class="endpoint"><code>POST /api/projects</code> - create a project and copy <code>snapshot.project.id</code></span></li>
        <li><span class="endpoint"><code>POST /api/events</code> - send proposal, planning, leader, coding, and review events</span></li>
        <li><span class="endpoint"><code>GET /api/projects/{projectId}</code> - read project snapshot after creating a project</span></li>
        <li><span class="endpoint"><code>GET /api/projects/{projectId}/next-actions</code> - read pending teammate actions</span></li>
      </ul>
      <p>For a complete copy-paste walkthrough, open <code>docs/API_EXAMPLES.md</code> in the repo.</p>
    </main>
  </body>
</html>`);
  });
}
