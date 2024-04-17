import OpenAI from "openai";
import config from "./config";
import api from "./api";
import PromptChain from "./prompt_chain";

class Agent {
  public clients: LLMClient[] = [];
  public agent: AgentData | null = null;
  private id: string;
  private url: string = config.api_url;
  private prompt_chain: PromptChain | null = null;
  private save_history: boolean | undefined;
  private store = null;

  private stream_listeners: ((message: StreamMessage) => any)[] = [];
  private status_listeners: ((status: string) => undefined)[] = [];
  private tool_calls_listeners: ((data: ToolCalledMessage) => undefined)[] = [];

  constructor(
    llmClients: LLMClient[],
    id: string,
    agent?: AgentData,
    save_history?: boolean,
  ) {
    this.clients = llmClients;
    this.id = id;
    this.save_history = save_history;
    if (agent) {
      this.agent = agent;
    }
  }

  private async loadAgent() {
    const agent = await api.loadAgent(this.id);
    this.agent = agent;
  }

  public async run(data: Inputs) {
    if (!this.agent) {
      await this.loadAgent();
    }

    const prompts = this.agent?.prompts || [];

    prompts.map((prompt) => {
      prompt.type;
    });
  }

  private streamResponse(message: StreamMessage) {
    this.stream_listeners.map((listener) => {
      listener(message);
    });
  }

  private updateStatus(status: string) {
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
