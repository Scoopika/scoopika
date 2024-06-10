import { test, expect } from "vitest";
import Agent from "../src/agent";
import { AgentData } from "@scoopika/types";
import Client from "../src/scoopika";

const dummy_agent: AgentData = {
  id: "agent",
  name: "Agento",
  description: "an agent that help make a plan for learning new things",
  prompts: [
    {
      id: "prompt-1",
      index: 0,
      model: "accounts/fireworks/models/firefunction-v1",
      llm_client: "fireworks",
      variable_name: "main3",
      options: {},
      type: "text",
      content: "You are a helpful AI assistant",
      inputs: [],
    },
  ],
  chained: false,
};

test("Running agent with tools and history", async () => {
  const client = new Client({
    store: "memory",
    engines: {
      fireworks: process.env["FIREWORKS_TOKEN"],
    },
  });

  const agent = await new Agent("agent", client, {
    agent: dummy_agent,
  }).load();

  const speak_run = await agent.run({
    options: { voice: true },
    inputs: {
      message: "Hello",
    },
    hooks: {
      onAudio: (audio) => {
        console.log(`GOT AUDIO: ${audio.index}`);
      },
    },
  });

  console.log(speak_run);

  const run = await agent.run({
    options: {
      session_id: "session123",
    },
    inputs: {
      message:
        "I want to learn how to play the chords of the latest song I searched for",
    },
  });

  const run2 = await agent.run({
    options: {
      session_id: "session123",
    },
    inputs: {
      message: "What was the name of the latest song I searched for again ?",
      context: [
        {
          description: "Latest search result",
          value: "Eagles - Hotel California",
        },
      ],
    },
  });

  expect(typeof run.content).toBe("string");

  expect(run.session_id).toBe("session123");
  expect(run2.session_id).toBe("session123");
  expect(String(run2.content).toLowerCase().includes("hotel california")).toBe(
    true,
  );
});
