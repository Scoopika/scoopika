import { AgentData, BoxHooks } from "@scoopika/types";
import Box from "./src/box";
import Client from "./src/scoopika";
import crypto from "node:crypto";
import { createToolSchema } from "./src/create_tool";
import { FromSchema, JSONSchema } from "json-schema-to-ts";
import readline from "node:readline";

const client = new Client({
  token: "token123",
  store: "http://127.0.0.1:8000", // Local data store url
  engines: {
    fireworks: process.env["FIREWORKS_API"],
  },
});

const agents: AgentData[] = [
  {
    id: "agent1",
    name: "Jack",
    description: "Helps with writing detailed reports",
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
        inputs: [],
        content: "You Help the user with writing detailed reports",
      },
    ],
  },
  // {
  //   id: "agent2",
  //   name: "Mark",
  //   description: "Knows a lot of information about mobile and PC games",
  //   chained: false,
  //   tools: [],
  //   prompts: [
  //     {
  //       id: "prompt1",
  //       type: "text",
  //       index: 0,
  //       variable_name: "info",
  //       llm_client: "fireworks",
  //       model: "accounts/fireworks/models/firefunction-v1",
  //       options: {},
  //       inputs: [],
  //       content: "You know a lot of information about mobile and PC games",
  //     },
  //   ],
  // },
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

const toolParameters = {
  type: "object",
  properties: {
    number: {
      type: "number",
      description: "the number of history results to get. default to 1",
      default: 1,
    },
  },
  required: ["number"],
} as const satisfies JSONSchema;

type ToolInputs = FromSchema<typeof toolParameters>;

const toolSchema = createToolSchema({
  name: "get_steam_history",
  description: "get the recent search history from Steam",
  parameters: toolParameters,
});

const toolFunction = (data: ToolInputs) => {
  console.log("TOOL CALLED", data.number);
  return "Classic cars";
};

box.addGlobalTool(toolFunction, toolSchema);

const hooks: BoxHooks = {
  onSelectAgent: (agent) => {
    console.log(`\n${agent.name}:`);
  },
  onToken: (token) => {
    process.stdout.write(token);
  },
  onAgentResponse: () => {
    console.log("\n-----\n");
  },
};

const session = crypto.randomUUID();

console.log(`STARTED SESSION: ${session}`);

const input_interface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function runBox(message: string) {
  await box.run({
    inputs: {
      message: message,
      session_id: session,
    },
    hooks,
  });
}

function getUserMessage() {
  input_interface.question("Your message: ", async (message) => {
    await runBox(message);
    getUserMessage();
  });
}

getUserMessage();
