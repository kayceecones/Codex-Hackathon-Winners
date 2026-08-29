import test from "node:test";
import assert from "node:assert/strict";
import { createEvent, Person3OutputEvent, submitPerson3OutputToMaster } from "../src/person3/index.ts";

test("submits Person 3 output events to the Master bridge endpoint", async () => {
  const event = createEvent(Person3OutputEvent.PLAN_VERSION_READY, {
    projectId: "project-1",
    planVersion: { title: "Plan v2: Dark Mode" },
  });

  let requestedUrl = "";
  let requestedBody = "";

  const result = await submitPerson3OutputToMaster(event, {
    masterApiUrl: "http://master.local/",
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedBody = String(init?.body);
      return new Response(
        JSON.stringify({
          message: "ok",
          transitions: [],
          dispatchedActions: [],
          nextActions: [],
        }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      );
    },
  });

  assert.equal(requestedUrl, "http://master.local/api/integrations/person3/events");
  assert.equal(JSON.parse(requestedBody).type, Person3OutputEvent.PLAN_VERSION_READY);
  assert.equal(result.message, "ok");
});