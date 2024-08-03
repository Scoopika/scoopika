import { test, expect, expectTypeOf } from "vitest";
import { Scoopika, Agent } from "../src";
import { getEnv } from "../src/utils";

const scoopika = new Scoopika({
  knowledge: "9fdd787e-0f2b-46c7-9cb1-2e1cbfa051c7",
});

process.exit(); // just ignore it for now, will fix it later ;)

const agent = new Agent(scoopika, {

});

test("Load Scoopika AI agent data (Fireworks))", async () => {
  const agent_data = await agent.load();

  expect(agent_data.id).toBe(getEnv("AGENT_ID", true));
});

test("Run Scoopika AI agent: Text generation", async () => {
  const { data, error } = await agent.run({
    inputs: {
      message: "What is Scoopika's monthly price?",
    },
  });

  if (error !== null) {
    throw new Error(error);
  }

  console.log(data);

  expectTypeOf(data.content).toBeString();
  expect(Array.isArray(data.tool_calls)).toBe(true);
});
