import { test, expect, expectTypeOf } from "vitest";
import { AgentClient } from "../src";
import { config } from "dotenv";
import { z } from "zod";

config();

const agent_id = process.env.AGENT_ID;

if (!agent_id) {
  throw new Error("Make sure AGENT_ID exist in .env file");
}

const agent = new AgentClient("http://localhost:4149/scoopika");

test("Run agent", async () => {
  let message: string = "";
  const { data: response, error } = await agent.run({
    options: {
      run_id: `run_${Date.now()}`,
    },
    inputs: {
      message: "Hello!",
    },
    hooks: {
      onStart: (s) => console.log(s),
      onToken: (t) => (message += t),
      onStream: (_s) => {},
    },
  });

  if (error !== null) throw new Error(error);

  expect(typeof response.content).toBe("string");
});

test("Run agent: object generation", async () => {
  const { data, error } = await agent.structuredOutput({
    inputs: { message: "My name is Kais" },
    schema: z.object({
      name: z.string().describe("The user name"),
    }),
    prompt: "Extract the user's name",
  });

  if (error !== null) throw new Error(error);

  expectTypeOf(data.name).toBeString();
});
