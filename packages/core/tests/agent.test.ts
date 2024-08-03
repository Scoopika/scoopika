import { test, expect, expectTypeOf } from "vitest";
import { Scoopika, Agent } from "../src";
import { z } from "zod";
import { getEnv } from "../src/utils";

const scoopika = new Scoopika();
scoopika.connectProvider("groq", getEnv("GROQ", true) as string);

const agent = new Agent(scoopika, {
  provider: "groq",
  model: "llama-3.1-70b-versatile",
  prompt: "You are a helpful AI assistant",
});

agent.addTool({
  name: "get_user",
  description: "Retrieve the user associated with a user ID if asked to",
  parameters: z.object({
    id: z.string().describe("The user ID to get the user name for"),
  }),
  execute: ({ id }) => {
    console.log("Called tool with ID:", id);
    return { name: "Kais Radwan" };
  },
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
