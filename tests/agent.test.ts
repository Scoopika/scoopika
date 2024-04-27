import { test, expect } from "vitest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Agent from "../src/agent";
import { AgentData } from "@scoopika/types";

const dummy_agent: AgentData = {
  id: "agent",
  name: "Agento",
  description: "Agent that help make a plan for learning new things",
  tools: [],
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
        "Output 3 main ideas about a plan for learning $topic, just 3 words and nothing else",
      inputs: [
        {
          id: "topic",
          description: "The learning topic",
          type: "string",
          required: true,
        },
      ],
    },
    {
      id: "prompt-2",
      index: 1,
      model: "accounts/fireworks/models/firefunction-v1",
      llm_client: "fireworks",
      variable_name: "descriptions",
      options: {},
      type: "text",
      content:
        "Output a description for each one of these 3 main ideas $main3 about a plan for learning $topic. make the description only 3 to 4 words",
      inputs: [
        {
          id: "topic",
          description: "The learning topic",
          type: "string",
          required: true,
        },
        {
          id: "main3",
          description: "The 3 main ideas",
          type: "string",
          required: true,
        },
      ],
    },
  ],
  chained: true,
};

test("Chained agent", async () => {
  const agent = new Agent({
    id: "agent",
    agent: dummy_agent,
    engines: {
      fireworks: process.env["FIREWORKS_API"],
    },
  });

  await agent.newSession("session1", "Kais");
  await agent.run({
    session_id: "session1",
    inputs: {
      topic: "playing guitar",
      // message: "My topic is about playing guitar",
    },
  });

  const run = await agent.run({
    session_id: "session1",
    inputs: {
      message: "Can you now translate the first one to french",
    },
  });

  console.log(run);

  expect(typeof run.responses.main3.content).toBe("string");
  expect(typeof run.responses.descriptions.content).toBe("string");
  expect(run.responses.main3.type).toBe("text");
  expect(run.session_id).toBe("session1");
});
