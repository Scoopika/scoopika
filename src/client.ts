import StateStore from "./state";
import InMemoryStore from "./store";
import * as types from "@scoopika/types";
import crypto from "node:crypto";

class Client {
  private url: string = "https://scoopika-source.deno.dev"; // Main API Url to get source data
  private token: string;
  public store: InMemoryStore;
  public memoryStore: InMemoryStore;
  public engines: types.RawEngines | undefined = {};
  private loadedSessions: Record<string, types.StoreSession> = {};
  public stateStore: StateStore;

  constructor({
    token,
    store,
    engines
  }: {
    token: string;
    store?: "memory" | string | InMemoryStore;
    engines?: types.RawEngines;
  }) {
    this.token = token;
    this.stateStore = new StateStore();
    this.memoryStore = new InMemoryStore();

    this.engines = engines;

    if (store === "memory") {
      this.store = new InMemoryStore();
    }

    this.store = new InMemoryStore();
  }

  public async getSession(id: string, allow_new?: boolean): Promise<types.StoreSession> {
    const loaded = this.loadedSessions[id];

    if (loaded) {
      return loaded;
    }

    let session = await this.store.getSession(id);

    if (!session && allow_new === false) {
      throw new Error(`Session '${id}' not found`);
    }

    if (!session) {
      session = await this.newSession({ id });
    }

    this.loadedSessions[id] = session;

    return session;
  }

  public async newSession({
    id,
    user_name,
  }: {
    id: string;
    user_name?: string;
  }): Promise<types.StoreSession> {
    const session_id = id || "session_" + crypto.randomUUID();

    await this.store.newSession(session_id, user_name);
    this.loadedSessions[session_id] = {
      id: session_id,
      user_name,
      saved_prompts: {},
    };
    this.stateStore.setState(session_id, 0);

    return { id, user_name, saved_prompts: {} };
  }

  public async loadAgent(id: string): Promise<types.AgentData> {
    const res = await fetch(this.url + `/agent/${id}`, {
      method: "GET",
      headers: {
        authorization: this.token
      }
    });

    const status = res.status;
    const data = await res.json();

    if (status !== 200) {
      throw new Error(data.error || `Server error, status: ${status}`);
    }

    if (!data.agent || typeof data.agent !== "object") {
      throw new Error("Invalid server response");
    }

    return data.agent as types.AgentData;
  }
}

export default Client;
