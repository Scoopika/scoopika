import { test, expect } from "vitest";
import Agent from "../src/agent";
import { AgentData } from "@scoopika/types";
import Client from "../src/scoopika";

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
        "you respond 3 main tips about how to learn the topic $topic. juts 3 main tips a nothing else",
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

test("Running agent with tools and history", async () => {
  const client = new Client({
    token: "hello",
    store: "memory",
    engines: {
      fireworks: process.env["FIREWORKS_API"],
    },
  });

  const agent = await new Agent("agent", client, {
    agent: dummy_agent,
  }).load();

  const run = await agent.run({
    session_id: "session1",
    topic: "playing guitar",
    message:
      "I want to learn how to play the chords of the latest song I searched for",
  });

  const run2 = await agent.run({
    session_id: "session1",
    message: "What was the name of the latest song I searched for again ?",
    plug: {
      rag: "New latest search result:\nEagles - Hotel California",
    },
  });

  expect(typeof run.responses.main.content).toBe("string");
  expect(run.responses.main.type).toBe("text");

  expect(run.session_id).toBe("session1");
  expect(run2.responses.main.type).toBe("text");
  expect(run2.session_id).toBe("session1");
  expect(
    String(run2.responses.main.content)
      .toLowerCase()
      .includes("hotel california"),
  ).toBe(true);
});
