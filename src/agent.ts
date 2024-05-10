import StateStore from "./state";
import buildClients from "./lib/build_clients";
import resolveInputs from "./lib/resolve_inputs";
import crypto from "node:crypto";
import * as types from "@scoopika/types";
import Scoopika from "./scoopika";
import Run from "./run";
import mixRuns from "./lib/mix_runs";

class Agent {
  public llm_clients: types.LLMClient[] = [];
  public agent: types.AgentData | null = null;
  private id: string;
  private client: Scoopika;
  private stateStore: StateStore;
  private saved_prompts: Record<string, Record<string, string>> = {};
  public tools: types.ToolSchema[] = [];

  streamFunc: types.StreamFunc | undefined;
  stream_listeners: types.StreamFunc[] = [];
  status_listeners: types.StatusUpdateFunc[] = [];
  tool_calls_listeners: ((call: types.LLMToolCall) => any)[] = [];
  tool_results_listeners: ((tool: {
    call: types.LLMToolCall;
    result: any;
  }) => any)[] = [];
  prompt_listeners: ((response: types.LLMResponse) => any)[] = [];
  finish_listeners: ((response: types.AgentResponse) => any)[] = [];

  constructor(
    id: string,
    client: Scoopika,
    options?: {
      agent?: types.AgentData;
      engines?: types.RawEngines;
      stateStore?: StateStore;
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
      this.stateStore = new StateStore();
      return;
    }

    const { agent, stateStore, engines, streamFunc } = options;

    if (stateStore) {
      this.stateStore = new StateStore();
    } else {
      this.stateStore = new StateStore();
    }

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
      typeof inputs.session_id === "string"
        ? inputs.session_id
        : "session_" + crypto.randomUUID();

    const original_inputs: types.Inputs = JSON.parse(JSON.stringify(inputs));
    const new_inputs: types.Inputs = await resolveInputs(inputs);
    const start = Date.now();
    const agent = this.agent as types.AgentData;
    const session = await this.client.getSession(session_id);
    const run_id =
      typeof inputs.run_id === "string"
        ? inputs.run_id
        : "run_" + crypto.randomUUID();

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
      tools: [...this.tools, ...(agent.tools || []), ...(inputs.tools || [])],
      stream: this.getStreamFunc(run_listeners),
      toolCallStream: this.getToolCallStreamFunc(
        hooks?.onToolCall && [hooks.onToolCall],
      ),
      toolResStream: this.getToolResStreamFunc(
        hooks?.onToolResult && [hooks.onToolResult],
      ),
    });
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

    await this.stateStore.setState(session.id, 0);
    const res: types.AgentResponse = {
      run_id,
      session_id,
      response: run.response,
    };

    if (inputs.save_history !== false) {
      await this.client.pushRuns(session, [
        {
          at: start,
          role: "user",
          user_id: session.user_id,
          request: original_inputs,
        },
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
  }: {
    inputs: types.Inputs;
    schema: types.ToolParameters;
  }) {
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
      agent.id,
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
      schema,
      history,
    });

    return output;
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

  getStreamFunc(
    run_listeners?: ((stream: types.StreamMessage) => void)[],
  ): types.StreamFunc {
    const listeners = [...this.stream_listeners, ...(run_listeners || [])];
    return (message: types.StreamMessage) => {
      for (const l of listeners) {
        l(message);
      }
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

  getToolCallStreamFunc(
    run_listeners?: ((call: types.LLMToolCall) => any)[],
  ): (call: types.LLMToolCall) => any {
    const listeners = [...this.tool_calls_listeners, ...(run_listeners || [])];
    return (call: types.LLMToolCall) => {
      listeners.map((l) => l(call));
    };
  }

  getToolResStreamFunc(
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

  private updateStatus(status: string): undefined {
    this.status_listeners.map((listener) => {
      listener(status);
    });
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

  public onPromptResponse(func: (response: types.LLMResponse) => any) {
    this.prompt_listeners.push(func);
  }

  public onFinish(func: (response: types.AgentResponse) => any) {
    this.finish_listeners.push(func);
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

  // TODO
  // Coming soon in later version
  public toTool() {
    throw new Error("This feature is coming soon..!");
  }
}

export default Agent;
