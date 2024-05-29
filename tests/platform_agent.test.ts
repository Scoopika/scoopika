import { Scoopika, Agent } from "../src";
import { test, expect } from "vitest";

const id = process.env.AGENT_ID;

if (!id) {
  throw new Error("Add AGENT_ID to .env to run this test");
}

const scoopika = new Scoopika({
  engines: {
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
      message: "Hello!",
    },
  });

  expect(typeof response.response.content).toBe("string");
});
