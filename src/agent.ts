import StateStore from "./state";
import buildClients from "./lib/build_clients";
import resolveInputs from "./lib/resolve_inputs";
import crypto from "node:crypto";
import * as types from "@scoopika/types";
import Scoopika from "./scoopika";
import Run from "./run";
import mixRuns from "./lib/mix_runs";
import { FromSchema, JSONSchema } from "json-schema-to-ts";

class Agent {
  public llm_clients: types.LLMClient[] = [];
  public agent: types.AgentData | null = null;
  public id: string;
  private client: Scoopika;
  public tools: types.ToolSchema[] = [];

  streamFunc: types.StreamFunc | undefined;
  stream_listeners: types.StreamFunc[] = [];
  status_listeners: types.StatusUpdateFunc[] = [];
  tool_calls_listeners: ((call: types.LLMToolCall) => any)[] = [];
  tool_results_listeners: ((tool: {
    call: types.LLMToolCall;
    result: any;
  }) => any)[] = [];
  finish_listeners: ((response: types.AgentResponse) => any)[] = [];

  constructor(
    id: string,
    client: Scoopika,
    options?: {
      agent?: types.AgentData;
      engines?: types.RawEngines;
      streamFunc?: types.StreamFunc;
    },
  ) {
    this.client = client;
    this.id = id;

    if (client.engines) {
      this.llm_clients = buildClients(client.engines);
    }

    if (client.loaded_agents[id]) {
      this.agent = client.loaded_agents[id];
    }

    if (!options) {
      return;
    }

    const { agent, engines, streamFunc } = options;

    if (agent) {
      this.agent = agent;
    }

    if (engines) {
      this.llm_clients = buildClients(engines);
    }

    this.streamFunc = streamFunc;
  }

  private async loadAgent() {
    const agent = await this.client.loadAgent(this.id);
    this.agent = agent;
  }

  public async load(): Promise<Agent> {
    if (this.agent) {
      return this;
    }

    await this.loadAgent();

    if (!this.agent) {
      throw new Error("Can't load agent data");
    }

    return this;
  }

  public async run({
    inputs,
    hooks,
  }: {
    inputs: types.Inputs;
    hooks?: types.Hooks;
  }): Promise<types.AgentResponse> {
    if (!this.agent) {
      await this.loadAgent();
    }

    const session_id: string =
      inputs.session_id || "session_" + crypto.randomUUID();
    const run_id = inputs.run_id || "run_" + crypto.randomUUID();
    const original_inputs: types.Inputs = JSON.parse(JSON.stringify(inputs));

    const new_inputs: types.Inputs = {
      ...(await resolveInputs(inputs)),
      session_id,
      run_id,
    };

    const start = Date.now();
    const agent = this.agent as types.AgentData;
    const session = await this.client.getSession(session_id);

    if (inputs.save_history !== false) {
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

    if (hooks && hooks.onStart) {
      hooks.onStart({ run_id, session_id });
    }

    const run_listeners: ((s: types.StreamMessage) => any)[] = [];

    if (hooks && hooks.onStream) {
      run_listeners.push(hooks.onStream);
    }

    if (hooks && hooks.onToken) {
      run_listeners.push(async (s: types.StreamMessage) => {
        if (hooks.onToken) {
          hooks.onToken(s.content);
        }
      });
    }

    const history: types.LLMHistory[] = await mixRuns(
      agent.id,
      session,
      await this.client.getSessionRuns(session),
    );

    const modelRun = new Run({
      session,
      clients: this.llm_clients,
      agent,
      tools: [],
      stream: this.getStreamFunc(run_listeners),
      toolCallStream: this.getToolCallStreamFunc(
        hooks?.onToolCall && [hooks.onToolCall],
      ),
      toolResStream: this.getToolResStreamFunc(
        hooks?.onToolResult && [hooks.onToolResult],
      ),
      clientActionStream: hooks?.onClientSideAction,
    });

    const wanted_tools = await this.selectTools(modelRun, history, new_inputs);
    modelRun.tools = wanted_tools;

    const run = await modelRun.run({ run_id, inputs: new_inputs, history });

    if (modelRun.built_prompt) {
      await this.client.store.updateSession(session_id, {
        ...session,
        saved_prompts: {
          ...session.saved_prompts,
          [agent.id]: modelRun.built_prompt,
        },
      });
    }

    const res: types.AgentResponse = {
      run_id,
      session_id,
      response: run.response,
    };

    if (inputs.save_history !== false) {
      await this.client.pushRuns(session, [
        {
          at: Date.now(),
          role: "agent",
          run_id,
          session_id,
          agent_id: agent.id,
          agent_name: agent.name,
          response: run.response,
          tools: run.tools_history,
        },
      ]);
    }

    this.finish_listeners.forEach((listener) => listener(res));

    if (hooks?.onFinish) {
      hooks.onFinish(res);
    }

    if (hooks?.onAgentResponse) {
      hooks.onAgentResponse({
        name: agent.name,
        response: res,
      });
    }

    return res;
  }

  public async structuredOutput<Data = Record<string, any>>({
    inputs,
    schema,
    system_prompt,
  }: {
    inputs: types.Inputs;
    schema: types.ToolParameters | JSONSchema;
    system_prompt?: string;
  }): Promise<Data> {
    if (!this.agent) {
      await this.loadAgent();
    }

    const session_id: string =
      typeof inputs.session_id === "string"
        ? inputs.session_id
        : "session_" + crypto.randomUUID();

    const agent = this.agent as types.AgentData;
    const session = await this.client.getSession(session_id);
    const new_inputs: types.Inputs = await resolveInputs(inputs);

    const history: types.LLMHistory[] = await mixRuns(
      "STRUCTURED",
      session,
      await this.client.getSessionRuns(session),
    );

    const modelRun = new Run({
      session,
      clients: this.llm_clients,
      agent,
      tools: [...this.tools, ...(agent.tools || []), ...(inputs.tools || [])],
      stream: () => {},
      toolCallStream: () => {},
      toolResStream: () => {},
    });
    const output = await modelRun.jsonRun<Data>({
      inputs: new_inputs,
      schema: schema as types.ToolParameters,
      history,
      system_prompt,
    });

    return output;
  }

  private getStreamFunc(
    run_listeners?: ((stream: types.StreamMessage) => void)[],
  ): types.StreamFunc {
    const listeners = [...this.stream_listeners, ...(run_listeners || [])];
    return (message: types.StreamMessage) => {
      for (const l of listeners) {
        l(message);
      }
    };
  }

  private getToolCallStreamFunc(
    run_listeners?: ((call: types.LLMToolCall) => any)[],
  ): (call: types.LLMToolCall) => any {
    const listeners = [...this.tool_calls_listeners, ...(run_listeners || [])];
    return (call: types.LLMToolCall) => {
      listeners.map((l) => l(call));
    };
  }

  private getToolResStreamFunc(
    run_listeners?: ((tool: { call: types.LLMToolCall; result: any }) => any)[],
  ): (tool: { call: types.LLMToolCall; result: any }) => any {
    const listeners = [
      ...this.tool_results_listeners,
      ...(run_listeners || []),
    ];
    return (tool: { call: types.LLMToolCall; result: any }) => {
      listeners.map((l) => l(tool));
    };
  }

  public onToolCall(call: types.LLMToolCall): undefined {
    this.tool_calls_listeners.map((listener) => listener(call));
  }

  public onStream(func: types.StreamFunc): void {
    this.stream_listeners.push(func);
  }

  public onToken(func: types.StreamFunc): void {
    this.stream_listeners.push(func);
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
    inputs: types.Inputs,
  ) {
    const tools: types.ToolSchema[] = [
      ...this.tools,
      ...(inputs.tools || []),
      ...(this.agent?.tools || []),
    ];

    const max = Number(inputs.max_tools || 5);

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

  public async asTool(): Promise<types.AgentToolSchema> {
    if (!this.agent) {
      await this.loadAgent();
    }

    const agent = this.agent as types.AgentData;
    const runFunc = this.run;

    const executor: types.AgentToolSchema["executor"] = async (
      session_id: string,
      run_id: string,
      instructions: string,
    ) => {
      const res = await runFunc({
        inputs: {
          session_id,
          run_id,
          message: instructions,
          save_history: false,
        },
      });

      return res.response.content;
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
