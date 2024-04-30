import Scoopika from "./scoopika";
import buildClients from "./lib/build_clients";
import crypto from "node:crypto";
import * as types from "@scoopika/types";
import Model from "./model";
import Agent from "./agent";

class Box {
  id: string;
  client: Scoopika;
  box: types.BoxData | undefined = undefined;
  llm_clients: types.LLMClient[] = [];

  tools: types.ToolSchema[] = [];
  agents_tools: Record<string, types.ToolSchema[]> = {};

  mentions: boolean = true;
  running_agent: string = "NONE";

  stream_listeners: types.BoxStreamFunc[] = [];
  prompt_listeners: ((response: types.LLMResponse) => any)[] = [];
  agent_selection_listeners: ((agent: types.AgentData) => any)[] = [];
  finish_listeners: ((
    response: { name: string; run: types.AgentResponse }[],
  ) => any)[] = [];

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

    if (!options) {
      return;
    }

    const { box, engines, system_prompt, mentions, tools } = options;

    this.box = box;

    if (engines) {
      this.llm_clients = buildClients(engines);
    } else if (client.engines) {
      this.llm_clients = buildClients(client.engines);
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

  async run(
    inputs: types.Inputs,
  ): Promise<{ name: string; run: types.AgentResponse }[]> {
    if (!this.box) {
      await this.load();
    }

    const session_id: string =
      typeof inputs.session_id === "string"
        ? inputs.session_id
        : "session_" + crypto.randomUUID();

    const box = this.box as types.BoxData;
    const session = await this.client.getSession(session_id);
    const run_id = "run_" + crypto.randomUUID();
    const streamFunc = this.getStreamFunc();
    const promptStreamFunc = this.getPromptStreamFunc();

    if (typeof inputs.run_id !== "string") {
      inputs.run_id = run_id;
    }

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
        continue;
      }

      this.agent_selection_listeners.forEach((listener) => listener(agentData));
      const agent = new Agent(agentData.id, this.client, {
        agent: {
          ...agentData,
          tools: [
            ...agentData.tools,
            ...this.tools,
            ...(this.agents_tools[agentData.name.toLowerCase()] || []),
          ],
        },
      });

      agent.onStream((stream: types.StreamMessage) => {
        streamFunc({
          prompt_name: stream.prompt_name,
          run_id: stream.run_id,
          content: stream.content,
          agent_name: this.running_agent,
        });
      });

      agent.onPromptResponse((response) => {
        promptStreamFunc(response);
      });

      this.running_agent = agentData.name;
      const run = await agent.run({
        ...inputs,
        message: selected.instructions,
      });
      responses.push({ name: agentData.name, run });
    }

    this.finish_listeners.forEach((listener) => listener(responses));

    return responses;
  }

  async selectAgents(
    inputs: types.Inputs,
    history: types.LLMHistory[],
  ): Promise<{ name: string; instructions: string }[]> {
    if (!inputs.message) {
      throw new Error("Inputs message is required in AI Boxes");
    }

    if (this.mentions && inputs.message.startsWith("@")) {
      const wanted_agents = this.box?.agents.filter(
        (agent) =>
          agent.name.toLowerCase() ===
          inputs.message?.split(" ")[0].replace("@", "").toLowerCase(),
      );

      if (wanted_agents && wanted_agents?.length > 0) {
        return [{ name: wanted_agents[0].name, instructions: inputs.message }];
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

    if (inputs.message) {
      messages.push({
        role: "user",
        content: `Instructions:\n${inputs.message}`,
      });
    }

    const { model, client } = this.getClient();
    const tools = this.buildTools();
    const modelRunner = new Model(client, undefined, tools);
    const LLM_inputs: types.LLMFunctionBaseInputs = {
      tools: tools.map((tool) => tool.tool),
      tool_choice: "any",
      messages,
      model,
      options: {
        temperature: 0,
      },
    };

    const run = await modelRunner.baseRun(
      "BOX",
      () => {},
      () => {},
      LLM_inputs,
      false,
      undefined,
      false,
    );

    if (!run.tool_calls || run.tool_calls.length < 1) {
      return [];
    }

    if (run.tool_calls.length === 1) {
      return [
        {
          name: run.tool_calls[0].function.name,
          instructions: inputs.message,
        },
      ];
    }

    const selected_agents: { name: string; instructions: string }[] = [];

    for (const call of run.tool_calls) {
      const args = JSON.parse(call.function.arguments);

      if (!args.instructions || typeof args.instructions !== "boolean") {
        args.instructions = inputs.message;
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
    inputs: types.Inputs,
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
            description: `${agent.name} is an agent. task: ${agent.description}`,
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

  getStreamFunc(): types.BoxStreamFunc {
    const listeners = this.stream_listeners;
    return (message: types.BoxStream) => {
      listeners.map((listener) => listener(message));
    };
  }

  getPromptStreamFunc(): (response: types.LLMResponse) => any {
    const listeners = this.prompt_listeners;
    return (response: types.LLMResponse) => {
      listeners.map((listener) => {
        listener(response);
      });
    };
  }

  onStream(func: types.BoxStreamFunc) {
    this.stream_listeners.push(func);
    return this;
  }

  onPromptResponse(func: (response: types.LLMResponse) => any) {
    this.prompt_listeners.push(func);
  }

  onToken(func: (message: types.StreamMessage) => any) {
    this.stream_listeners.push(func);
  }

  onImage(func: (img: types.LLMImageResponse) => any) {
    this.prompt_listeners.push((response) => {
      if (response.type !== "image") {
        return;
      }

      func(response);
    });
  }

  onSelectAgent(func: (agent: types.AgentData) => any) {
    this.agent_selection_listeners.push(func);
  }

  onFinish(
    func: (response: { name: string; run: types.AgentResponse }[]) => any,
  ) {
    this.finish_listeners.push(func);
  }

  addGlobalTool(
    func: (args: Record<string, any>) => any,
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

  addTool(
    agent_name: string,
    func: (args: Record<string, any>) => any,
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

  system_prompt = `You are a manager that chooses from a number of AI agents to execute a specific task. choose the most suitable agent for the task.`;
}

export default Box;
