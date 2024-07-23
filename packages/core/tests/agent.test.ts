import { test, expect, expectTypeOf } from "vitest";
import { Scoopika, Agent } from "../src";
import { getEnv } from "../src/utils";
import { z } from "zod";

const scoopika = new Scoopika();

const agent = new Agent(getEnv("AGENT_ID", true) as string, scoopika);

test("Load Scoopika AI agent data (Fireworks))", async () => {
  const agent_data = await agent.load();

  expect(agent_data.id).toBe(getEnv("AGENT_ID", true));
});

test("Run Scoopika AI agent: Text generation", async () => {
  const { data, error } = await agent.run({
    inputs: {
      message: "Hello, what's your name?",
    },
  });

  if (error !== null) {
    throw new Error(error);
  }

  expectTypeOf(data.content).toBeString();
  expect(Array.isArray(data.tool_calls)).toBe(true);
});

test("Run Scoopika AI agent: Function calling", async () => {
  const { data, error } = await agent.run({
    inputs: {
      message: "Can you get the user name assosiated with the user ID 123",
    },
  });

  if (error !== null) {
    throw new Error(error);
  }

  console.log(data);

  expectTypeOf(data.content).toBeString();
  expect(Array.isArray(data.tool_calls)).toBe(true);
  expect(data.tool_calls.length).toBeGreaterThan(0);
});

test("Run Scoopika AI agent: Object generation", async () => {
  const { data, error } = await agent.structuredOutput({
    inputs: {
      message: "My name is Kais Radwan",
    },
    schema: z.object({
      name: z.string().describe("The user name"),
    }),
    prompt: "I want you to generate a JSON object returning the user name",
  });

  if (error !== null) {
    throw new Error(error);
  }

  console.log(data);

  expect(typeof data.name).toBe("string");
});
