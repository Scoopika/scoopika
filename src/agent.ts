import buildClients from "./lib/build_clients";
import resolveInputs from "./lib/resolve_inputs";
import crypto from "node:crypto";
import * as types from "@scoopika/types";
import Scoopika from "./scoopika";
import Run from "./run";
import mixRuns from "./lib/mix_runs";
import { FromSchema, JSONSchema } from "json-schema-to-ts";
import Hooks from "./hooks";
import AudioStore from "./audio_store";

class Agent {
  public llm_clients: types.LLMClient[] = [];
  public agent: types.AgentData | null = null;
  public id: string;
  private client: Scoopika;
  public tools: types.ToolSchema[] = [];
  public hooks: Hooks;

  constructor(
    id: string,
    client: Scoopika,
    options?: {
      agent?: types.AgentData;
      engines?: types.RawEngines;
      dangerouslyAllowBrowser?: boolean;
    },
  ) {
    this.client = client;
    this.id = id;
    this.hooks = new Hooks();
    this.llm_clients = buildClients(
      client.engines,
      options?.dangerouslyAllowBrowser,
    );

    if (client.loaded_agents[id]) {
      this.agent = client.loaded_agents[id];
    }

    if (!options) {
      return;
    }

    const { agent, engines } = options;

    if (agent) {
      this.agent = agent;
    }

    if (engines) {
      this.llm_clients = buildClients(engines);
    }
  }

  private async loadAgent() {
    const agent = this.agent || (await this.client.loadAgent(this.id));
    const prompt = agent.prompts[0];

    if (!prompt) {
      throw new Error("The agent does not have a prompt!");
    }

    const host = prompt.llm_client;

    if (this.llm_clients.filter((l) => l.host === host).length < 1) {
      const platform_keys = await this.client.loadKeys();
      const platform_engines: Record<string, string> = {};
      platform_keys.forEach((k) => {
        platform_engines[k.name] = k.value;
      });
      const platform_clients = buildClients(platform_engines);
      this.llm_clients = [...this.llm_clients, ...platform_clients];
    }

    if (this.llm_clients.filter((l) => l.host === host).length < 1) {
      throw new Error(
        `This agent uses ${host} and no key for it is found in your server or account`,
      );
    }

    if (agent?.in_tools) {
      await this.buildInTools(agent.in_tools);
    }

    this.agent = agent;
  }

  public async load(): Promise<Agent> {
    await this.loadAgent();

    if (!this.agent) {
      throw new Error("Can't load agent data");
    }

    return this;
  }

  public async run({
    inputs,
    options,
    hooks,
    hooksStore,
  }: {
    inputs: types.RunInputs;
    options?: types.RunOptions;
    hooks?: types.Hooks;
    hooksStore?: Hooks;
  }): Promise<types.AgentResponse> {
    await this.loadAgent();

    const agent = this.agent as types.AgentData;
    const session_id: string =
      options?.session_id || "session_" + crypto.randomUUID();
    const run_id = options?.run_id || "run_" + crypto.randomUUID();
    const original_inputs: types.Inputs = JSON.parse(JSON.stringify(inputs));

    if (!hooksStore) {
      hooksStore = new Hooks();
    }

    hooksStore.addRunHooks(hooks || {});
    const audioStore = new AudioStore({
      scoopika: this.client,
      hooks: hooksStore,
      run_id,
      voice: agent.voice,
    });

    if (options?.speak === true) {
      audioStore.turnOn();
    }

    const new_inputs: types.RunInputs = {
      ...(await resolveInputs(this.client, inputs)),
    };

    const start = Date.now();
    const session = await this.client.getSession(session_id);

    if (options?.save_history !== false) {
      this.client.pushRuns(session, [
        {
          at: start,
          role: "user",
          session_id,
          run_id,
          user_id: session.user_id,
          request: original_inputs,
        },
      ]);
    }

    hooksStore.executeHook("onStart", { run_id, session_id });
    const history: types.LLMHistory[] = await mixRuns(
      this.client,
      agent.id,
      session,
      await this.client.getSessionRuns(session),
    );

    const modelRun = new Run({
      session,
      clients: this.llm_clients,
      agent,
      tools: [],
      hooks: hooksStore,
    });

    const wanted_tools = await this.selectTools(
      modelRun,
      history,
      new_inputs,
      options,
    );
    modelRun.tools = wanted_tools;

    const run = await modelRun.run({
      run_id,
      inputs: new_inputs,
      options: { session_id, run_id },
      history,
    });

    if (modelRun.built_prompt) {
      await this.client.store.updateSession(session_id, {
        ...session,
        saved_prompts: {
          ...session.saved_prompts,
          [agent.id]: modelRun.built_prompt,
        },
      });
    }

    const audioDone = await audioStore.isDone();
    if (!audioDone) {
      console.error("ERROR: Not all audio chunks generated successfully!");
    }

    const res: types.AgentResponse = {
      run_id,
      session_id,
      content: run.response.content,
      audio: audioStore.chunks,
      tools_calls: run.tools_history,
    };

    if (options?.save_history !== false) {
      await this.client.pushRuns(session, [
        {
          at: Date.now(),
          role: "agent",
          run_id,
          session_id,
          agent_id: agent.id,
          agent_name: agent.name,
          response: res,
          tools: run.tools_history,
        },
      ]);
    }

    hooksStore.executeHook("onFinish", res);
    hooksStore.executeHook("onAgentResponse", {
      name: agent.name,
      response: res,
    });

    return res;
  }

  public async structuredOutput<Data = Record<string, any>>({
    inputs,
    options,
    schema,
    system_prompt,
  }: {
    inputs: types.RunInputs;
    options: types.RunOptions;
    schema: types.ToolParameters | JSONSchema;
    system_prompt?: string;
  }): Promise<Data> {
    await this.loadAgent();

    const session_id: string =
      typeof options?.session_id === "string"
        ? options?.session_id
        : "session_" + crypto.randomUUID();

    const agent = this.agent as types.AgentData;
    const session = await this.client.getSession(session_id);
    const new_inputs: types.RunInputs = await resolveInputs(
      this.client,
      inputs,
    );

    const history: types.LLMHistory[] = await mixRuns(
      this.client,
      "STRUCTURED",
      session,
      await this.client.getSessionRuns(session),
    );

    const modelRun = new Run({
      session,
      clients: this.llm_clients,
      agent,
      tools: [...this.tools, ...(agent.tools || []), ...(options?.tools || [])],
      hooks: new Hooks(),
    });

    const output = await modelRun.jsonRun<Data>({
      inputs: new_inputs,
      schema: schema as types.ToolParameters,
      history,
      system_prompt,
    });

    return output;
  }

  public async info<K extends keyof types.AgentData>(
    key: K,
  ): Promise<types.AgentData[K]> {
    if (!this.agent) {
      await this.loadAgent();
    }
    if (!this.agent) {
      throw new Error("Agent not loaded");
    }

    return this.agent[key];
  }

  public addTool<Data = any>(
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

    return this;
  }

  public async addAgentAsTool(agent: Agent) {
    const agent_tool = await agent.asTool();
    this.tools.push(agent_tool);

    return this;
  }

  private async selectTools(
    run: Run,
    history: types.LLMHistory[],
    inputs: types.RunInputs,
    options?: types.RunOptions,
  ) {
    const tools: types.ToolSchema[] = [
      ...this.tools,
      ...(options?.tools || []),
      ...(this.agent?.tools || []),
    ];

    const max = Number(options?.max_tools || 5);

    if (tools.length <= max) {
      return tools;
    }

    const prompt =
      "Your role is to select at most 7 tools that might be helpful to achieve the user request from a list of available tools, never make up new tools, and don't include tools that are not relevant to the user request. output a JSON object with the names of the tools that might be useful based on the context of previous conversations and current user request";

    const string_tools: string[] = tools.map(
      (t) => `${t.tool.function.name}: ${t.tool.function.description}`,
    );
    const message =
      (inputs.message || "") +
      `\n\nAvailable tools:\n${string_tools.join(".\n")}`;

    const schema = {
      type: "object",
      properties: {
        tools: {
          description:
            "The selected tools names that are relevant to the context",
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: ["tools"],
    } as const satisfies JSONSchema;

    type Output = FromSchema<typeof schema>;

    const output = await run.jsonRun<Output>({
      inputs: { ...inputs, message },
      system_prompt: prompt,
      history,
      schema: schema as any as types.ToolParameters,
    });

    const selected_names = output.tools.slice(0, 4);
    const wanted = tools.filter(
      (t) => selected_names.indexOf(t.tool.function.name) !== -1,
    );

    return wanted;
  }

  // setup tools added in the platform
  private async buildInTools(in_tools: types.InTool[]) {
    for (const tool of in_tools) {
      if (tool.type === "agent") {
        const agent = new Agent(tool.id, this.client);
        await this.addAgentAsTool(agent);
        continue;
      }

      const headers: Record<string, string> = {};
      tool.headers.forEach((h) => {
        headers[h.key] = h.value;
      });

      this.tools.push({
        type: "api",
        url: tool.url,
        method: tool.method,
        headers,
        body: tool.body,
        tool: {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputs,
          },
        },
      });
    }
  }

  public async asTool(): Promise<types.AgentToolSchema> {
    if (!this.agent) {
      await this.loadAgent();
    }

    const agent = this.agent as types.AgentData;
    const runFunc = this.run.bind(this);

    const executor: types.AgentToolSchema["executor"] = async (
      session_id: string,
      run_id: string,
      instructions: string,
    ) => {
      const res = await runFunc({
        options: { session_id, run_id, save_history: false },
        inputs: {
          message: instructions,
        },
      });

      return res.content;
    };

    const agent_tool: types.AgentToolSchema = {
      type: "agent",
      agent_id: this.id,
      executor,
      tool: {
        type: "function",
        function: {
          name: agent.name,
          description: `an AI agent called ${agent.name}. its task is: ${agent.description}`,
          parameters: {
            type: "object",
            properties: {
              instructions: {
                type: "string",
                description:
                  "The instruction or task to give the agent. include all instructions to guide this agent",
              },
            },
            required: ["instructions"],
          },
        },
      },
    };

    return agent_tool;
  }
}

export default Agent;
