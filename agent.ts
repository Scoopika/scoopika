import OpenAI from "openai";
import config from "./config";
import api from "./api";
import PromptChain from "./prompt_chain";

class Agent {
  public clients: Record<string, OpenAI> = {};
  public agent: AgentData | null = null;
  private id: string;
  private url: string = config.api_url;
  private prompt_chain: PromptChain | null = null;
  private save_history: boolean | undefined;
  private store = null;
  private stream_listeners: ((content: string) => any)[] = [];
  private status_listeners: ((status: string) => undefined)[] = [];

  constructor(
    llmClients: Record<string, OpenAI>,
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

  private streamResponse(content: string, final?: boolean) {
    this.stream_listeners.map(listener => { listener(content) });
  }

  public onStream(func: (content: string) => any) {
    this.stream_listeners.push(func);
  }

  private updateStatus(status: string) {
    this.status_listeners.map(listener => { listener(status) });
  }

  public onStatusUpdate(func: (status: string) => undefined) {
    this.status_listeners.push(func);
  }
}

export { Agent };
