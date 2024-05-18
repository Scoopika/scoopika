import { LLMHistory, RunHistory, Store, StoreSession } from "@scoopika/types";
import crypto from "node:crypto";

class InMemoryStore implements Store {
  public history: Record<string, LLMHistory[]> = {};
  public sessions: Record<string, StoreSession> = {};
  public users_sessions: Record<string, string[]> = {};
  public runs: Record<string, RunHistory[]> = {};

  async newSession({
    id,
    user_id,
    user_name,
  }: {
    id?: string;
    user_id?: string;
    user_name?: string;
  }) {
    const session_id = id ?? "session_" + crypto.randomUUID();

    this.sessions[session_id] = {
      id: session_id,
      user_id,
      user_name,
      saved_prompts: {},
    };
    this.history[session_id] = [];
    this.runs[session_id] = [];

    if (!user_id) {
      return;
    }

    if (!this.users_sessions[user_id]) {
      this.users_sessions[user_id] = [];
    }

    this.users_sessions[user_id].push(session_id);
  }

  async getSession(id: string): Promise<StoreSession | undefined> {
    const wanted_session = this.sessions[id];
    return wanted_session;
  }

  async deleteSession(id: string) {
    if (this.sessions[id]) {
      delete this.sessions[id];
    }

    if (this.history[id]) {
      delete this.history[id];
    }
  }

  async getUserSessions(user_id: string): Promise<string[]> {
    return this.users_sessions[user_id] || [];
  }

  async updateSession(
    id: string,
    new_data: {
      user_name?: string;
      saved_prompts?: Record<string, string>;
    },
  ) {
    const session = this.sessions[id];

    if (!session) {
      throw new Error(`Session '${id}' not found`);
    }

    const new_session = { ...session, ...new_data };
    this.sessions[id] = new_session;
  }

  async getHistory(session: StoreSession | string): Promise<LLMHistory[]> {
    const id = typeof session === "string" ? session : session.id;
    const history = this.history[id];

    if (!history || history.length < 1) {
      return [];
    }

    const string_history = JSON.stringify(history);
    return JSON.parse(string_history) as LLMHistory[];
  }

  async pushHistory(
    session: StoreSession | string,
    new_history: LLMHistory,
  ): Promise<void> {
    const id = typeof session === "string" ? session : session.id;
    if (!this.history[id]) {
      this.history[id] = [];
    }
    this.history[id].push(new_history);
  }

  async batchPushHistory(
    session: StoreSession,
    new_history: LLMHistory[],
  ): Promise<void> {
    for await (const h of new_history) {
      await this.pushHistory(session, h);
    }
  }

  async pushRun(session: StoreSession | string, run: RunHistory) {
    const id = typeof session === "string" ? session : session.id;
    if (!this.runs[id]) {
      this.runs[id] = [];
    }

    this.runs[id].push(run);
  }

  async batchPushRuns(session: StoreSession | string, runs: RunHistory[]) {
    runs.forEach((r) => this.pushRun(session, r));
  }

  async getRuns(session: StoreSession | string): Promise<RunHistory[]> {
    const id = typeof session === "string" ? session : session.id;
    return this.runs[id] || [];
  }
}

export default InMemoryStore;
