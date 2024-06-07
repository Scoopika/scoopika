import Scoopika from "./scoopika";
import buildClients from "./lib/build_clients";
import crypto from "node:crypto";
import * as types from "@scoopika/types";
import Model from "./model";
import Agent from "./agent";
import resolveInputs from "./lib/resolve_inputs";
import Hooks from "./hooks";

class Box {
  id: string;
  client: Scoopika;
  box: types.BoxData | undefined = undefined;
  llm_clients: types.LLMClient[] = [];
  hooks: Hooks;

  tools: types.ToolSchema[] = [];
  agents_tools: Record<string, types.ToolSchema[]> = {};

  mentions: boolean = true;
  running_agent: string = "NONE";

  constructor(
    id: string,
    client: Scoopika,
    options?: {
      box?: types.BoxData;
      engines?: types.RawEngines;
      system_prompt?: string;
      mentions?: boolean;
      tools?: types.ToolSchema[];
    },
  ) {
    this.id = id;
    this.client = client;
    this.hooks = new Hooks();

    if (client.loaded_boxes[id]) {
      this.box = client.loaded_boxes[id];
    }

    if (client.engines) {
      this.llm_clients = buildClients(client.engines);
    }

    if (!options) {
      return;
    }

    const { box, engines, system_prompt, mentions, tools } = options;

    this.box = box;

    if (engines) {
      this.llm_clients = buildClients(engines);
    }

    if (system_prompt) {
      this.system_prompt = system_prompt;
    }

    if (tools) {
      this.tools = tools;
    }

    if (typeof mentions === "boolean") {
      this.mentions = mentions;
    }
  }

  async load(): Promise<Box> {
    if (this.box) {
      return this;
    }

    this.box = await this.client.loadBox(this.id);
    return this;
  }

  async run({
    inputs,
    options,
    hooks,
  }: {
    inputs: types.RunInputs;
    options?: types.RunOptions;
    hooks?: types.BoxHooks;
  }): Promise<{ name: string; run: types.AgentResponse }[]> {
    if (!this.box) {
      await this.load();
    }

    options = options || {};
    const hooksStore = new Hooks(this.hooks.hooks);
    hooksStore.addRunHooks(hooks || {});

    const session_id: string =
      options?.session_id || "session_" + crypto.randomUUID();
    const run_id = options?.run_id || "run_" + crypto.randomUUID();

    const box = this.box as types.BoxData;
    const session = await this.client.getSession(session_id);

    if (typeof options?.run_id !== "string") {
      options.run_id = run_id;
    }

    hooksStore.executeHook("onStart", { run_id, session_id });
    const history = this.setupHistory(
      session,
      inputs,
      await this.client.store.getHistory(session),
    );

    const selected_agents = await this.selectAgents(inputs, history);
    const responses: {
      name: string;
      run: types.AgentResponse;
    }[] = [];

    for (const selected of selected_agents) {
      const agentData = box?.agents.filter(
        (a) => a.name.toLowerCase() === selected.name.toLowerCase(),
      )[0];

      if (!agentData) {
        console.error(`Agent ${selected.name} could not be loaded.. skipping!`);
        continue;
      }

      hooksStore.executeHook("onSelectAgent", agentData);
      const agent = new Agent(agentData.id, this.client, {
        agent: {
          ...agentData,
          tools: [
            ...agentData.tools,
            ...this.tools,
            ...(this.agents_tools[agentData.name.toLowerCase()] || []),
            ...(this.agents_tools[agentData.id] || []),
          ],
        },
      });

      this.running_agent = agentData.name;
      const run = await agent.run({
        inputs: {
          ...inputs,
          message: selected.instructions,
        },
      });
      responses.push({ name: agentData.name, run });
    }

    hooksStore.executeHook("onBoxFinish", responses);

    return responses;
  }

  async selectAgents(
    inputs: types.RunInputs,
    history: types.LLMHistory[],
  ): Promise<{ name: string; instructions: string }[]> {
    const new_inputs = await resolveInputs(this.client, inputs);

    if (!new_inputs.message) {
      throw new Error("Inputs message is required in AI Boxes");
    }

    if (this.mentions && new_inputs.message.startsWith("@")) {
      const wanted_agents = this.box?.agents.filter(
        (agent) =>
          agent.name.toLowerCase() ===
          new_inputs.message?.split(" ")[0].replace("@", "").toLowerCase(),
      );

      if (wanted_agents && wanted_agents?.length > 0) {
        return [
          { name: wanted_agents[0].name, instructions: new_inputs.message },
        ];
      }
    }

    const messages: types.LLMHistory[] = [
      {
        role: "system",
        content: this.system_prompt,
      },
      ...history,
    ];

    if (history.length > 2) {
      messages.push({
        role: "user",
        content: this.system_prompt,
      });
    }

    if (new_inputs.message) {
      messages.push({
        role: "user",
        content: `Instructions:\n${new_inputs.message}`,
      });
    }

    const { model, client } = this.getClient();
    const tools = this.buildTools();
    const modelRunner = new Model(client, tools);
    const LLM_inputs: types.LLMFunctionBaseInputs = {
      tools: tools.map((tool) => tool.tool),
      tool_choice: "any",
      messages,
      model,
      options: {
        temperature: 0,
      },
    };

    const run = await modelRunner.baseRun({
      run_id: "BOX",
      session_id: "DUMMY_SESSION_" + crypto.randomUUID(),
      inputs: LLM_inputs,
      execute_tools: false,
      hooks: new Hooks(),
    });

    if (!run.tool_calls || run.tool_calls.length < 1) {
      return [];
    }

    if (run.tool_calls.length === 1) {
      return [
        {
          name: run.tool_calls[0].function.name,
          instructions: new_inputs.message,
        },
      ];
    }

    const selected_agents: { name: string; instructions: string }[] = [];

    for (const call of run.tool_calls) {
      const args = JSON.parse(call.function.arguments);

      if (!args.instructions || typeof args.instructions !== "boolean") {
        args.instructions = new_inputs.message;
      }

      selected_agents.push({
        name: call.function.name,
        instructions: args.instructions,
      });
    }

    return selected_agents;
  }

  getClient(): { model: string; client: types.LLMClient } {
    const box = this.box as types.BoxData;
    const wanted_clients = this.llm_clients.filter(
      (l) => l.host === box.llm_client,
    );

    if (wanted_clients?.length < 1) {
      throw new Error(`LLM Client not found for ${box.llm_client}`);
    }

    return { model: box.manager, client: wanted_clients[0] };
  }

  setupHistory(
    session: types.StoreSession,
    inputs: types.RunInputs,
    history: types.LLMHistory[],
  ): types.LLMHistory[] {
    const newHistory: types.LLMHistory[] = JSON.parse(JSON.stringify(history));

    if (typeof inputs.message === "string") {
      newHistory.push({
        role: "user",
        name: session.user_name || "User",
        content: inputs.message,
      });
    }

    return newHistory;
  }

  buildTools(): types.ToolSchema[] {
    if (!this.box) {
      return [];
    }
    const tools: types.ToolSchema[] = [];

    for (const agent of this.box.agents) {
      tools.push({
        type: "function",
        executor: () => {},
        tool: {
          type: "function",
          function: {
            name: agent.name,
            description: `${agent.name} is an AI agent. task: ${agent.description}`,
            parameters: {
              type: "object",
              properties: {
                instructions: {
                  type: "string",
                  description: "The instruction or task to give the agent",
                },
              },
              required: ["instructions"],
            },
          },
        },
      });
    }

    return tools;
  }

  addGlobalTool<Data = any>(
    func: (args: Data) => any,
    tool: types.ToolFunction,
  ) {
    this.tools.push({
      type: "function",
      executor: func,
      tool: {
        type: "function",
        function: tool,
      },
    });
  }

  addTool<Data = any>(
    agent_name: string,
    func: (args: Data) => any,
    tool: types.ToolFunction,
  ) {
    if (!this.agents_tools[agent_name.toLowerCase()]) {
      this.agents_tools[agent_name.toLowerCase()] = [];
    }

    this.agents_tools[agent_name.toLowerCase()].push({
      type: "function",
      executor: func,
      tool: {
        type: "function",
        function: tool,
      },
    });
  }

  public async addAgentAsTool(agent: Agent) {
    const agent_tool = await agent.asTool();
    this.tools.push(agent_tool);
    return this;
  }

  system_prompt = `You are a manager that chooses from a number of AI agents to execute a specific task. choose the most suitable agent for the task.`;
}

export default Box;
