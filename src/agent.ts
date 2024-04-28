import api from "./api";
import PromptChain from "./prompt_chain";
import InMemoryStore from "./store";
import StateStore from "./state";
import buildClients from "./lib/build_clients";
import crypto from "node:crypto";
import * as types from "@scoopika/types";
import Client from "./client";

class Agent {
  public llm_clients: types.LLMClient[] = [];
  public agent: types.AgentData | null = null;
  private id: string;
  private client: Client;
  private store: InMemoryStore;
  private stateStore: StateStore;
  private loadedSessions: types.StoreSession[] = [];
  private standalone: boolean = true;
  private saved_prompts: Record<string, Record<string, string>> = {};

  streamFunc: types.StreamFunc | undefined;
  stream_listeners: ((message: types.StreamMessage) => any)[] = [];
  status_listeners: ((status: string) => undefined)[] = [];
  tool_calls_listeners: ((data: types.ToolCalledMessage) => undefined)[] = [];

  constructor(id: string, client: Client, {
    agent,
    engines,
    stateStore,
    store,
    standalone,
    streamFunc,
  }: {
    agent?: types.AgentData;
    engines?: types.RawEngines;
    stateStore?: StateStore;
    store?: InMemoryStore;
    standalone?: boolean;
    streamFunc?: types.StreamFunc;
  }) {
    this.client = client;

    if (!stateStore) {
      stateStore = new StateStore();
    }

    if (!store) {
      store = new InMemoryStore();
    } else {
      this.store = client.store;
    }

    if (typeof standalone !== "boolean") {
      standalone = true;
    }

    this.standalone = standalone;
    this.store = store;
    this.stateStore = stateStore;
    this.id = id;
    if (agent) {
      this.agent = agent;
    }

    if (engines) {
      this.llm_clients = buildClients(engines);
    } else if (client.engines) {
      this.llm_clients = buildClients(client.engines);
    }

    this.streamFunc = streamFunc;
  }

  private async loadAgent() {
    const agent = await this.client.loadAgent(this.id);
    this.agent = agent;
  }

  public async load(): Promise<Agent> {
    if (this.agent) {
      return this
    }

    await this.loadAgent();

    if (!this.agent) {
      throw new Error("Can't load agent data");
    }

    return this;
  }

  public async run(inputs: types.Inputs): Promise<types.AgentResponse> {
    if (!this.agent) {
      await this.loadAgent();
    }

    const session_id: string =
      typeof inputs.session_id === "string"
        ? inputs.session_id
        : "session_" + crypto.randomUUID();

    const agent = this.agent as types.AgentData;
    const session = await this.client.getSession(session_id);
    const run_id = "run_" + crypto.randomUUID();

    const { run, saved_prompts } = await this.chainRun({
      run_id,
      session,
      agent,
      inputs,
    });

    await this.client.store.batchPushHistory(session, run.updated_history);
    this.updateSavedPrompts(session, saved_prompts);

    await this.stateStore.setState(session.id, 0);

    if (!this.agent?.chained) {
      return {
        run_id,
        session_id,
        responses: {
          main: run.responses[Object.keys(run.responses)[0]]
        }
      }
    }

    return {
      run_id,
      session_id: session.id,
      responses: run.responses,
    };
  }

  async chainRun({
    run_id,
    session,
    agent,
    inputs,
  }: types.AgentRunInputs): Promise<{
    run: types.AgentInnerRunResult;
    saved_prompts: Record<string, string>;
  }> {
    const prompt_chain = new PromptChain({
      session,
      agent,
      clients: this.llm_clients,
      stream: this.getStreamFunc(),
      statusUpdate: this.updateStatus,
      tools: agent.tools,
      prompts: agent.prompts,
      saved_prompts: this.saved_prompts[session.id] || {},
    });

    const history = this.setupHistory(
      session,
      inputs,
      await this.client.store.getHistory(session),
    );

    const run = await prompt_chain.run({
      run_id,
      inputs,
      messages: history,
      wanted_responses: agent.wanted_responses,
      timeout: agent.timeout,
    });

    const updated_history: types.LLMHistory[] = !inputs.message
      ? run.updated_history
      : [
          {
            role: "user",
            name: session.user_name,
            content: inputs.message,
          },
          ...run.updated_history,
        ];

    return {
      run: { ...run, updated_history },
      saved_prompts: prompt_chain.saved_prompts,
    };
  }

  async updateSavedPrompts(
    session: types.StoreSession,
    new_prompts: Record<string, string>,
  ) {
    this.saved_prompts[session.id] = new_prompts;
    await this.client.store.updateSession(session.id, { saved_prompts: new_prompts });
  }

  setupHistory(
    session: types.StoreSession,
    inputs: types.Inputs,
    history: types.LLMHistory[],
  ): types.LLMHistory[] {
    if (typeof inputs.message === "string") {
      return [
        ...history,
        {
          role: "user",
          name: session.user_name || "User",
          content: inputs.message,
        },
      ];
    }

    return history;
  }

  getStreamFunc(): types.StreamFunc {
    if (this.streamFunc) {
      return this.streamFunc;
    }
    const listeners = this.stream_listeners;
    return (message: types.StreamMessage) => {
      listeners.map((listener) => {
        listener(message);
      });
    };
  }

  private updateStatus(status: string): undefined {
    this.status_listeners.map((listener) => {
      listener(status);
    });
  }

  private toolCalled(data: types.ToolCalledMessage): undefined {
    this.tool_calls_listeners.map((listener) => listener(data));
  }

  public on({ type, func }: types.OnListener): undefined {
    if (type === "stream") {
      this.stream_listeners.push(func);
      return;
    }

    if (type === "status") {
      this.status_listeners.push(func);
      return;
    }

    this.tool_calls_listeners.push(func);
  }

  public async get<K extends keyof types.AgentData>(key: K): Promise<types.AgentData[K]> {
    if (!this.agent) {
      await this.loadAgent();
    }
    if (!this.agent) {
      throw new Error("Agent not loaded");
    }

    return this.agent[key];
  }
}

export default Agent;
