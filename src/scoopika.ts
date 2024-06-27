import RemoteStore from "./remote_store";
import StateStore from "./state";
import InMemoryStore from "./store";
import * as types from "@scoopika/types";
import crypto from "node:crypto";

const VOICES = ["aura-orpheus-en", "aura-luna-en"];

class Scoopika {
  // Main API Url to get source data
  private url: string =
    process.env.SCOOPIKA_SOURCE || "https://dev.scoopika.com";
  private token: string;
  public store: InMemoryStore | RemoteStore;
  public memoryStore: InMemoryStore;
  public engines: types.RawEngines = {};
  public stateStore: StateStore;
  private default_voice: string = VOICES[0];
  public providers_urls: Record<types.AllEngines, string> &
    Record<string, string> = {
    together: "https://api.together.xyz/v1",
    fireworks: "https://api.fireworks.ai/inference/v1",
    openai: "",
    google: "",
    groq: "https://api.groq.com/openai/v1",
    perplexity: "https://api.perplexity.ai",
  };

  // Will be used soon for caching somehow
  public loaded_agents: Record<string, types.AgentData> = {};
  public loaded_boxes: Record<string, types.BoxData> = {};
  host_audio: boolean = true;
  beta_allow_knowledge: boolean = false;

  constructor({
    token,
    store,
    keys,
    host_audio,
    beta_allow_knowledge,
  }: {
    token?: string;
    store?: string | InMemoryStore | RemoteStore;
    keys?: types.RawEngines;
    host_audio?: boolean;
    beta_allow_knowledge?: boolean;
  } = {}) {
    const access_token = token || process.env.SCOOPIKA_TOKEN;

    if (typeof host_audio === "boolean") {
      this.host_audio = host_audio;
    }

    if (typeof beta_allow_knowledge === "boolean") {
      this.beta_allow_knowledge = beta_allow_knowledge;
    }

    if (!access_token || access_token.length < 1) {
      throw new Error(
        "Scoopika access token not found, pass it as a prop or add SCOOPIKA_TOKEN to your environment variables",
      );
    }

    this.token = access_token;
    this.stateStore = new StateStore();
    this.memoryStore = new InMemoryStore();

    this.engines = keys || {};

    if (!store) {
      store = new InMemoryStore();
    }

    if (store === "memory") {
      store = new InMemoryStore();
    } else if (typeof store === "string") {
      store = new RemoteStore(access_token, `${this.url}/store/${store}`);
    }

    this.store = store;
  }

  public getUrl() {
    return this.url;
  }

  public extendProviders(name: string, url: string) {
    this.providers_urls[name] = url;
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
    const session_id = id ?? "session_" + crypto.randomUUID();

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
    return runs.sort((a, b) => a.at - b.at);
  }

  public async getSessionMessages(
    session: types.StoreSession | string,
  ): Promise<types.RunHistory[]> {
    const runs = await this.store.getRuns(session);
    return runs.sort((a, b) => a.at - b.at);
  }

  public async getSessionHistory(
    session: types.StoreSession | string,
  ): Promise<types.LLMHistory[]> {
    const history = await this.store.getHistory(session);
    return history;
  }

  public async getRun(
    session: types.StoreSession | string,
    id: string,
    role?: "user" | "agent",
  ): Promise<types.RunHistory[]> {
    const runs = await this.store.getRuns(session);
    const run = runs.filter(
      (run) => (run.run_id === id && run.role === role) || run.role,
    );
    return run;
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
    const data = await res.json();

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
    const data = await res.json();

    if (status !== 200) {
      throw new Error(data.error || `Server error, status: ${status}`);
    }

    if (!data.box || typeof data.box !== "object") {
      throw new Error("Invalid server response");
    }

    this.loaded_boxes[id] = data.box as types.BoxData;
    return data.box as types.BoxData;
  }

  public async loadKeys(): Promise<
    {
      name: string;
      value: string;
    }[]
  > {
    const res = await fetch(this.url + "/main/keys", {
      method: "GET",
      headers: {
        authorization: this.token,
      },
    });

    const data = (await res.json()) as
      | {
          success: false;
          error: string;
        }
      | {
          success: true;
          keys: { name: string; value: string }[];
        };

    if (!data?.success) {
      const err = data.error || "Remote server error";
      throw new Error(`ERROR loading API keys (${res.status}): ${err}`);
    }

    return data.keys;
  }

  public async readAudio(audio: string | types.AudioRes) {
    const audio_url = typeof audio === "string" ? audio : audio.read;

    const res = await fetch(audio_url);
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer);
  }

  public async speak({ text, voice }: { text: string; voice?: string }) {
    voice = voice || this.default_voice;

    if (VOICES.indexOf(voice) === -1) {
      console.warn("Invalid voice. falling to default voice");
      voice = this.default_voice;
    }

    const res = await fetch(this.url + "/main/speak", {
      method: "POST",
      headers: {
        authorization: this.token,
      },
      body: JSON.stringify({ text, voice }),
    });

    const data = await res.json();

    if (!data || !data.success) {
      const err = data.error || "Remote server error: Can't generate audio";
      throw new Error(err);
    }

    return data as { url: string; usage: number; id: string };
  }

  public async generateAudioId(text: string, voice?: string): Promise<string> {
    voice = voice ?? this.default_voice;
    if (VOICES.indexOf(voice) === -1) {
      voice = this.default_voice;
      console.warn("Invalid agent voice. falling back to default");
    }

    const res = await fetch(`${this.url}/audio/new`, {
      method: "POST",
      headers: { authorization: this.token },
      body: JSON.stringify({ voice, text }),
    });

    const data = await res.json();
    const id = data?.id;

    if (!data?.success || typeof id !== "string") {
      const err = data?.error || "Remote server error: Can't genearte audio ID";
      throw new Error(err);
    }

    return id;
  }

  public async listen(audio: types.AudioPlug) {
    const res = await fetch(this.url + "/main/listen", {
      method: "POST",
      headers: {
        authorization: this.token,
      },
      body: JSON.stringify({
        data: audio,
        host: this.host_audio,
      }),
    });

    const data:
      | {
          success: false;
          error: string;
        }
      | {
          success: true;
          text: string;
          url: string;
        } = await res.json();

    if (!data || !data.success) {
      const err = data.error || "Can't recognize speech";
      throw new Error(`Remote sevrer error: ${err}`);
    }

    return { text: data.text, url: data.url };
  }

  async rag(id: string, text: string): Promise<string> {
    if (!this.beta_allow_knowledge) {
      return "";
    }

    try {
      const res = await fetch(`${this.url}/pro/query-knowledge/${id}`, {
        method: "POST",
        headers: { authorization: this.token },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      return (data?.data || "") as string;
    } catch (err) {
      console.error("Error loading custom knowledge", err);
      return "";
    }
  }
}

export default Scoopika;
