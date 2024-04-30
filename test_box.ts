import { AgentData } from "@scoopika/types";
import Box from "./src/box";
import Client from "./src/client";

const client = new Client({
  token: "token123",
  store: "memory",
  engines: {
    fireworks: process.env["FIREWORKS_API"],
  },
});

const agents: AgentData[] = [
  {
    id: "agent1",
    name: "Jack",
    description: "Writes 3 main keywords about a research topic",
    chained: false,
    tools: [],
    prompts: [
      {
        id: "prompt1",
        type: "text",
        index: 0,
        variable_name: "article",
        llm_client: "fireworks",
        model: "accounts/fireworks/models/firefunction-v1",
        options: {},
        inputs: [
          {
            type: "string",
            id: "topic",
            description: "The technology topic to research and write about",
            required: true,
          },
        ],
        content: "Write 3 main keywords about this research topic: $topic",
      },
    ],
  },
  {
    id: "agent2",
    name: "Mark",
    description: "Knows a lot of information about mobile and PC games",
    chained: false,
    tools: [],
    prompts: [
      {
        id: "prompt1",
        type: "text",
        index: 0,
        variable_name: "info",
        llm_client: "fireworks",
        model: "accounts/fireworks/models/firefunction-v1",
        options: {},
        inputs: [
          {
            type: "string",
            id: "game",
            description: "The game title we need to get information about",
            required: true,
          },
        ],
        content: "",
      },
    ],
  },
];

const box = new Box("box123", client, {
  box: {
    id: "box123",
    manager: "accounts/fireworks/models/firefunction-v1",
    llm_client: "fireworks",
    tools: [],
    agents: agents,
  },
  mentions: false,
});

box.onSelectAgent((agent) => {
  console.log("Selected agent:", agent.name);
});

box.onFinish((responses) => {
  console.log(responses);
});

box.addGlobalTool(() => {}, {
  name: "save_data",
  description: "Save data to the database",
  parameters: {
    type: "object",
    properties: {
      data: {
        type: "string",
        description: "The data to be saved as text",
      },
    },
    required: ["data"],
  },
});

box
  .run({ session_id: "s123", message: "my research topic is about robotics" })
  .then((res) => {
    box
      .run({
        session_id: "s123",
        message: "Can you give me some games related to that",
      })
      .then(() => {
        box.run({
          message: "Hello, how are you?",
        });
      });
  });
