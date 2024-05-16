import RemoteStore from "./remote_store";
import StateStore from "./state";
import InMemoryStore from "./store";
import * as types from "@scoopika/types";
import crypto from "node:crypto";

class Scoopika {
  private url: string = "https://scoopika-source.deno.dev"; // Main API Url to get source data
  private token: string;
  public store: InMemoryStore | RemoteStore;
  public memoryStore: InMemoryStore;
  public engines: types.RawEngines = {};
  public stateStore: StateStore;

  // Will be used soon for caching somehow
  public loaded_agents: Record<string, types.AgentData> = {};
  public loaded_boxes: Record<string, types.BoxData> = {};

  constructor({
    token,
    store,
    engines,
  }: {
    token: string;
    store?: "memory" | string | InMemoryStore | RemoteStore;
    engines?: types.RawEngines;
  }) {
    this.token = token;
    this.stateStore = new StateStore();
    this.memoryStore = new InMemoryStore();

    this.engines = engines || {};

    if (!store) {
      store = new InMemoryStore();
    }

    if (store === "memory") {
      store = new InMemoryStore();
    } else if (typeof store === "string") {
      store = new RemoteStore(token, store);
    }

    this.store = store;
  }

  // Sessions

  public async getSession(
    id: string,
    allow_new?: boolean,
  ): Promise<types.StoreSession> {
    let session = await this.store.getSession(id);

    if (!session && allow_new === false) {
      throw new Error(`Session '${id}' not found`);
    }

    if (!session) {
      session = await this.newSession({ id });
    }

    return session;
  }

  public async newSession({
    id,
    user_name,
    user_id,
  }: {
    id?: string;
    user_name?: string;
    user_id?: string;
  }): Promise<types.StoreSession> {
    const session_id = id || "session_" + crypto.randomUUID();

    await this.store.newSession({ id: session_id, user_id, user_name });
    this.stateStore.setState(session_id, 0);

    return { id: session_id, user_name, user_id, saved_prompts: {} };
  }

  public async deleteSession(id: string) {
    await this.store.deleteSession(id);
    return this;
  }

  public async pushRuns(
    session: types.StoreSession | string,
    runs: types.RunHistory[],
  ) {
    await this.store.batchPushRuns(session, runs);
  }

  public async listUserSessions(user_id: string): Promise<string[]> {
    const sessions = await this.store.getUserSessions(user_id);
    return sessions;
  }

  public async getSessionRuns(
    session: types.StoreSession | string,
  ): Promise<types.RunHistory[]> {
    const runs = await this.store.getRuns(session);
    return runs;
  }

  public async getSessionHistory(
    session: types.StoreSession | string,
  ): Promise<types.LLMHistory[]> {
    const history = await this.store.getHistory(session);
    return history;
  }

  // Loading

  public async loadAgent(id: string): Promise<types.AgentData> {
    const res = await fetch(this.url + `/main/agent/${id}`, {
      method: "GET",
      headers: {
        authorization: this.token,
      },
    });

    const status = res.status;
    const data = (await res.json()) as any;

    if (!data.success) {
      throw new Error(`Remote server error: ${data.error || "Unknown error"}`);
    }

    if (status !== 200) {
      throw new Error(data.error || `Server error, status: ${status}`);
    }

    if (!data.agent || typeof data.agent !== "object") {
      throw new Error("Invalid server response");
    }

    this.loaded_agents[id] = data.agent as types.AgentData;
    return data.agent as types.AgentData;
  }

  public async loadBox(id: string): Promise<types.BoxData> {
    const res = await fetch(this.url + `/main/box/${id}`, {
      method: "GET",
      headers: {
        authorization: this.token,
      },
    });

    const status = res.status;
    const data = (await res.json()) as any;

    if (status !== 200) {
      throw new Error(data.error || `Server error, status: ${status}`);
    }

    if (!data.box || typeof data.box !== "object") {
      throw new Error("Invalid server response");
    }

    this.loaded_boxes[id] = data.box as types.BoxData;
    return data.box as types.BoxData;
  }
}

export default Scoopika;
