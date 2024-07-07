import buildClients from "./lib/build_clients";
import resolveInputs from "./lib/resolve_inputs";
import crypto from "node:crypto";
import * as types from "@scoopika/types";
import Scoopika from "./scoopika";
import Run from "./run";
import mixRuns from "./lib/mix_runs";
import Hooks from "./hooks";
import AudioStore from "./audio_store";
import agentAsTool from "./lib/agent_as_tool";
import { createSchema } from "./create_schema";
import { z } from "zod";
import { createTool } from "./create_tool";
import madeToolToFunctionTool from "./lib/made_tool_to_function_tool";
import { JSONSchema } from "openai/lib/jsonschema";

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
      this.client.providers_urls,
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
      this.llm_clients = buildClients(
        this.client.providers_urls,
        engines,
        options?.dangerouslyAllowBrowser,
      );
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
      const platform_clients = buildClients(
        this.client.providers_urls,
        platform_engines,
      );
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
      options?.session_id ?? "session_" + crypto.randomUUID();
    const run_id = options?.run_id ?? "run_" + crypto.randomUUID();
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

    if (options?.voice === true) {
      audioStore.turnOn();
    }

    const { new_inputs, context_message } = await resolveInputs(
      this.client,
      inputs,
    );

    const start = Date.now();
    const session = await this.client.getSession(session_id);

    hooksStore.executeHook("onStart", { run_id, session_id });
    const history: types.LLMHistory[] = await mixRuns(
      await this.client.getSessionMessages(session),
    );

    if (options?.save_history !== false) {
      await this.client.pushRuns(session, [
        {
          at: start,
          role: "user",
          session_id,
          run_id,
          user_id: session.user_id,
          request: {
            ...original_inputs,
            audio: new_inputs.audio,
          },
          resolved_message: context_message,
        },
      ]);
    }

    const modelRun = new Run({
      scoopika: this.client,
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

  public async generateJSON({
    inputs,
    options,
    schema,
    system_prompt,
  }: {
    inputs: types.RunInputs;
    options?: types.RunOptions;
    schema: JSONSchema;
    system_prompt?: string;
  }) {
    await this.loadAgent();

    const session_id: string =
      options?.session_id ?? "session_" + crypto.randomUUID();
    const agent = this.agent as types.AgentData;
    const session = await this.client.getSession(session_id);
    const { new_inputs } = await resolveInputs(this.client, inputs);

    const history: types.LLMHistory[] = await mixRuns(
      await this.client.getSessionMessages(session),
    );

    const modelRun = new Run({
      scoopika: this.client,
      session,
      clients: this.llm_clients,
      agent,
      tools: [...this.tools, ...(agent.tools || []), ...(options?.tools || [])],
      hooks: new Hooks(),
    });

    const output = await modelRun.jsonRun<any>({
      inputs: new_inputs,
      schema,
      history,
      system_prompt,
    });

    return output;
  }

  public async structuredOutput<
    SCHEMA extends z.ZodTypeAny = any,
    DATA = z.infer<SCHEMA>,
  >({
    inputs,
    options,
    schema,
    system_prompt,
  }: {
    inputs: types.RunInputs;
    options?: types.RunOptions;
    schema: SCHEMA;
    system_prompt?: string;
  }): Promise<DATA> {
    await this.loadAgent();

    const session_id: string =
      options?.session_id ?? "session_" + crypto.randomUUID();
    const agent = this.agent as types.AgentData;
    const session = await this.client.getSession(session_id);
    const { new_inputs } = await resolveInputs(this.client, inputs);

    const history: types.LLMHistory[] = await mixRuns(
      await this.client.getSessionMessages(session),
    );

    const modelRun = new Run({
      scoopika: this.client,
      session,
      clients: this.llm_clients,
      agent,
      tools: [...this.tools, ...(agent.tools || []), ...(options?.tools || [])],
      hooks: new Hooks(),
    });

    const json_schema = createSchema(schema);
    const output = await modelRun.jsonRun<DATA>({
      inputs: new_inputs,
      schema: json_schema,
      history,
      system_prompt,
    });

    return output as DATA;
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

  public addTool<PARAMETERS extends z.ZodTypeAny, RESULT = any>(
    tool?: types.CoreTool<PARAMETERS, RESULT>,
  ) {
    if (!tool) return;
    const built_tool = createTool(tool);
    this.tools = [
      ...this.tools.filter((t) => t.tool.function.name !== tool.name),
      madeToolToFunctionTool(built_tool),
    ];
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

    const schema = createSchema(
      z.object({
        tools: z
          .array(z.string())
          .describe("The selected tools name that are relevant to the context"),
      }),
    );

    const output = await run.jsonRun<{ tools: string[] }>({
      inputs: { ...inputs, message },
      system_prompt: prompt,
      history,
      schema: schema,
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

      this.tools = [
        ...(this.tools.filter((t) => t.tool.function.name !== tool.name) || []),
        {
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
        },
      ];
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

    const tool = agentAsTool(agent, executor);
    return tool;
  }
}

export default Agent;
