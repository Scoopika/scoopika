import config from "./config";
import api from "./api";
import PromptChain from "./prompt_chain";
import InMemoryStore from "./store";
import StateStore from "./state";
import crypto from "node:crypto";
import mixHistory from "./lib/mix_history";
import { warn } from "node:console";

class Agent {
  public clients: LLMClient[] = [];
  public agent: AgentData | null = null;
  private id: string;
  private url: string = config.api_url;
  private prompt_chain: PromptChain | null = null;
  private store: InMemoryStore;
  private stateStore: StateStore;
  private loadedSessions: StoreSession[] = [];
  private standalone: boolean;
  private saved_prompts: Record<string, string> = {};

  stream_listeners: ((message: StreamMessage) => any)[] = [];
  private status_listeners: ((status: string) => undefined)[] = [];
  private tool_calls_listeners: ((data: ToolCalledMessage) => undefined)[] = [];

  constructor({
    id, agent, llmClients, stateStore, store, standalone
  }: {
    id: string,
    agent?: AgentData,
    llmClients?: LLMClient[],
    stateStore?: StateStore,
    store?: InMemoryStore,
    standalone?: boolean
  }) {
    if (!stateStore) {
      stateStore = new StateStore();
    }

    if (!store) {
      store = new InMemoryStore();
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

    if (llmClients) {
      this.clients = llmClients;
    }
  }

  // Sessions

  public async newSession(session_id: string, user_name?: string) {
    await this.store.newSession(session_id, user_name);
    this.loadedSessions.push({ id: session_id, user_name });
  }

  private async getSession(id: string): Promise<StoreSession> {
    const loaded = this.loadedSessions.filter(s => s.id === id);
    let session: StoreSession;

    if (loaded.length > 0) {
      session = loaded[0];
    } else {
      session = await this.store.getSession(id);
      this.loadedSessions.push(session);
    }

    return session;
  }

  private async loadAgent() {
    const agent = await api.loadAgent(this.id);
    this.agent = agent;
  }

  private async loadClients() {
    this.clients = await api.loadClients();
  }

  public async run({
    session_id, inputs, 
  }: {
    session_id: string,
    inputs: Inputs,
  }) {
    if (!this.agent) {
      await this.loadAgent();
    }

    if (this.clients.length < 1) {
      await this.loadClients();
    }

    const agent = this.agent as AgentData;
    const session = await this.getSession(session_id);

    if (this.agent?.chained) {
      return await this.chain_run({ session, agent, inputs });
    }
  }

  setupHistory(session: StoreSession, inputs: Inputs, history: LLMHistory[]) {
    let content: string;
    if (typeof inputs.message === "string") {
      content = inputs.message;
    } else {
      content = JSON.stringify(inputs);
    }

    history.push({
      role: "user",
      name: session.user_name || "User",
      content
    });

    return history;
  }

  async chain_run({
    session, agent, inputs
  }: {
    session: StoreSession,
    agent: AgentData,
    inputs: Inputs
  }): Promise<Record<string, LLMResponse>> {
    const prompt_chain = new PromptChain({
      session,
      agent,
      clients: this.clients,
      stream: this.getStreamFunc(),
      statusUpdate: this.updateStatus,
      tools: agent.tools,
      prompts: agent.prompts,
      saved_prompts: this.saved_prompts
    });

    const history = this.setupHistory(session, inputs, await this.store.getHistory(session));
    const run = await prompt_chain.run({
      run_id: `run_${crypto.randomUUID()}`,
      inputs,
      history,
      wanted_responses: agent.wanted_responses,
      timeout: agent.timeout,
    })

    this.saved_prompts = prompt_chain.saved_prompts;
    console.log(this.saved_prompts);

    const updated_history = run.updated_history.map(h => {
      if (h.role === "model") {
        h.name = agent.name;
      }

      return h;
    })

    if (typeof inputs.message === "string") {
      updated_history.unshift({
        role: "user",
        content: String(inputs.message),
        name: session.user_name || "User"
      });
    }

    // TODO: The history is not working well. CAREFUL.

    await this.store.batchPushHistory(session, updated_history);

    return run.responses;
  }

  getStreamFunc(): StreamFunc {
    const listeners = this.stream_listeners;
    return (message: StreamMessage) => {
      listeners.map(listener => { listener(message); });
    }
  }

  private updateStatus(status: string): undefined {
    this.status_listeners.map((listener) => {
      listener(status);
    });
  }

  private toolCalled(data: ToolCalledMessage): undefined {
    this.tool_calls_listeners.map(listener => listener(data)); 
  }

  public on({ type, func }: OnListener): undefined {
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
}

export default Agent;
