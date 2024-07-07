import { Scoopika, Agent } from "../src";
import { test, expect } from "vitest";

const id = process.env.AGENT_ID;

if (!id) {
  throw new Error("Add AGENT_ID to .env to run this test");
}

const scoopika = new Scoopika({
  keys: {
    fireworks: process.env.FIREWORKS_TOKEN,
  },
});
const agent = new Agent(id, scoopika);

test("Load from the platform", async () => {
  await agent.load();

  expect(typeof agent.agent?.name).toBe("string");
});

test("Run agent from the platform", async () => {
  const response = await agent.run({
    inputs: {
      message:
        "Search for the user given the query 'Kais'. send 'Kais' as the query to the tool",
    },
  });

  console.log(response.tools_calls[0]);

  expect(typeof response.content).toBe("string");
});
