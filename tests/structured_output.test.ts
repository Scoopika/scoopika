import { test, expect } from "vitest";
import Agent from "../src/agent";
import { AgentData } from "@scoopika/types";
import Client from "../src/scoopika";
import { z } from "zod";

const dummy_agent: AgentData = {
  id: "agent",
  name: "Agento",
  description: "an agent that help make a plan for learning new things",
  tools: [
    {
      type: "function",
      executor: (_inputs: any) => {
        console.log("TOOL CALL");
        return "[Eminem - lose yourself]";
      },
      tool: {
        type: "function",
        function: {
          name: "get_search_history",
          description: "Get the search history",
          parameters: {
            type: "object",
            properties: {
              n: {
                type: "number",
                description: "The number of wanted results, default to 1",
                default: 1,
              },
            },
            required: ["n"],
          },
        },
      },
    },
  ],
  prompts: [
    {
      id: "prompt-1",
      index: 0,
      model: "accounts/fireworks/models/firefunction-v1",
      llm_client: "fireworks",
      variable_name: "main3",
      options: {},
      type: "text",
      content:
        "you respond with 3 main tips about how to learn the topic $topic. juts 3 main tips a nothing else",
      inputs: [
        {
          id: "topic",
          description: "The learning topic",
          type: "string",
          required: true,
        },
      ],
    },
  ],
  chained: false,
};

const client = new Client({
  token: "hello",
  store: "memory",
  keys: {
    fireworks: process.env["FIREWORKS_TOKEN"],
  },
});

const agent = new Agent(dummy_agent.id, client, {
  agent: dummy_agent,
});

test("Running agent with structured output", async () => {
  const run = await agent.structuredOutput({
    inputs: {
      message: "My name is Kais",
    },
    schema: z.object({
      name: z.string().describe("The user name"),
    }),
  });

  expect(typeof run.name).toBe("string");
  expect(run.name.toLowerCase()).toBe("kais");
});
