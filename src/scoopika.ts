import RemoteStore from "./remote_store";
import StateStore from "./state";
import InMemoryStore from "./store";
import * as types from "@scoopika/types";
import crypto from "node:crypto";

class Scoopika {
  // Main API Url to get source data
  private url: string =
    process.env.SCOOPIKA_SOURCE || "https://dev.scoopika.com";
  private token: string;
  public store: InMemoryStore | RemoteStore;
  public memoryStore: InMemoryStore;
  public engines: types.RawEngines = {};
  public stateStore: StateStore;
  private default_voice: string = "m-us-1";

  // Will be used soon for caching somehow
  public loaded_agents: Record<string, types.AgentData> = {};
  public loaded_boxes: Record<string, types.BoxData> = {};

  constructor({
    token,
    store,
    engines,
  }: {
    token?: string;
    store?: string | InMemoryStore | RemoteStore;
    engines?: types.RawEngines;
  } = {}) {
    const access_token = token || process.env.SCOOPIKA_TOKEN;

    if (!access_token || access_token.length < 1) {
      throw new Error(
        "Scoopika access token not found, pass it as a prop or add SCOOPIKA_TOKEN to your environment variables",
      );
    }

    this.token = access_token;
    this.stateStore = new StateStore();
    this.memoryStore = new InMemoryStore();

    this.engines = engines || {};

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

  getUrl() {
    return this.url;
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
    return runs;
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
    role: "user" | "agent" = "agent",
  ): Promise<types.RunHistory | undefined> {
    const runs = await this.store.getRuns(session);
    const run = runs.filter((run) => run.run_id === id && run.role === role)[0];
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
    const audio_id = typeof audio === "string" ? audio : audio.audio_id;

    const res = await fetch(this.url + `/pro/audio/${audio_id}`, {
      headers: {
        authorization: this.token,
      },
    });

    const binary = await res.arrayBuffer();
    return Buffer.from(binary);
  }

  public async speak({ text, voice }: { text: string; voice?: string }) {
    voice = voice || this.default_voice;

    const res = await fetch(this.url + "/pro/speak", {
      method: "POST",
      headers: {
        authorization: this.token,
      },
      body: JSON.stringify({
        text,
        speaker: voice,
      }),
    });

    const data = await res.json();

    if (!data || !data.success) {
      const err = data.error || "Remote server error: Can't generate audio";
      throw new Error(err);
    }

    const id = data.output;

    if (typeof id !== "string") {
      throw new Error(
        "Can't generate audio. contact support at team@scoopika.com",
      );
    }

    return id;
  }

  public async recognizeSpeech(binary: Buffer | ArrayBuffer) {
    const binary_data = binary.toString("base64");
    const res = await fetch(this.url + "/pro/recognize-speech", {
      method: "POST",
      headers: {
        authorization: this.token,
      },
      body: JSON.stringify({ data: binary_data }),
    });

    const data:
      | {
          success: false;
          error: string;
        }
      | {
          success: true;
          text: string;
        } = await res.json();

    if (!data || !data.success) {
      const err = data.error || "Can't recognize speech";
      throw new Error(`Remote sevrer error: ${err}`);
    }

    return data.text;
  }

  // TODO: MOVE TO CLIENT SIDE
  // public async readRunAudio(
  //   run: types.AgentRunHistory | types.AudioRes[]
  // ) {
  //   const audio = Array.isArray(run) ? run : run.response.audio;
  //
  //   if (!audio || audio.length < 1) {
  //     throw new Error("The run has no audio to read");
  //   }
  //
  //   const crunker = new Crunker();
  //   const buffers = await crunker.fetchAudio(
  //     ...audio.map(a => a.read)
  //   );
  //
  //   const one_buffer = crunker.concatAudio(buffers);
  //   return one_buffer;
  // }
}

export default Scoopika;
