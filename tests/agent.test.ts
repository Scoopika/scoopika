import { test, expect } from "vitest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Agent from "../src/agent";
import sleep from "../src/lib/sleep";

const google_client = new GoogleGenerativeAI(
  process.env.GOOGLE_API_KEY as string,
);

const dummy_agent: AgentData = {
  id: "agent",
  name: "Agento",
  description: "Agent that help make a plan for learning new things",
  tools: [],
  prompts: [
    {
      id: "prompt-1",
      index: 0,
      model: "gemini-1.5-pro-latest",
      llm_client: "google",
      variable_name: "main3",
      options: {},
      type: "text",
      content:
        "Output 3 main ideas about a plan for learning <<topic>>, just 3 words and nothing else",
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
      model: "gemini-1.5-pro-latest",
      llm_client: "google",
      variable_name: "descriptions",
      options: {},
      type: "text",
      content:
        "Output a description for each one of these 3 main ideas <<main3>> about a plan for learning <<topic>>. make the description only 3 to 4 words",
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
    llmClients: [{ host: "google", client: google_client }],
  });

  await agent.newSession("session1", "Kais");
  agent.run({
    session_id: "session1",
    inputs: {
      topic: "playing guitar",
    },
  });

  // Google now has a limit of 2 req/min so we need to sleep for a minute here
  await sleep(60000);

  const run = await agent.run({
    session_id: "session1",
    inputs: {
      message: "Can you now translate the first one to french",
    },
  });

  expect(typeof run.responses.main3.content).toBe("string");
  expect(typeof run.responses.descriptions.content).toBe("string");
  expect(run.responses.main3.type).toBe("text");
  expect(run.session_id).toBe("session1");
});
