import new_error from "./lib/error";
import { LLMHistory, Store, StoreSession } from "@scoopika/types";

class InMemoryStore implements Store {
  public history: Record<string, LLMHistory[]> = {};
  public sessions: Record<string, StoreSession> = {};

  constructor() {}

  checkSession(session: StoreSession): undefined {
    const sessions = this.sessions[session.id];
    if (!sessions) {
      throw new Error(
        new_error(
          "session_notfound",
          `The session '${session.id}' does not exist`,
          "session check",
        ),
      );
    }
  }

  async newSession(id: string, user_name?: string) {
    this.sessions[id] = { id, user_name, saved_prompts: {} };
    this.history[id] = [];
  }

  async getSession(id: string): Promise<StoreSession | undefined> {
    const wanted_sessions = this.sessions[id];
    return wanted_sessions;
  }

  async updateSession(
    id: string,
    new_data: {
      user_name?: string;
      saved_prompts?: Record<string, string>;
    },
  ) {
    const session = await this.getSession(id);

    if (!session) {
      throw new Error(`Session '${id}' not found`);
    }

    const new_session = { ...session, ...new_data };
    this.sessions[id] = new_session;
  }

  async getHistory(session: StoreSession): Promise<LLMHistory[]> {
    this.checkSession(session);

    const history = this.history[session.id];

    if (!history || history.length < 1) {
      return [];
    }

    const string_history = JSON.stringify(history);
    return JSON.parse(string_history) as LLMHistory[];
  }

  async pushHistory(
    session: StoreSession,
    new_history: LLMHistory,
  ): Promise<void> {
    if (!this.history[session.id]) {
      this.history[session.id] = [];
    }
    this.history[session.id].push(new_history);
  }

  async batchPushHistory(
    session: StoreSession,
    new_history: LLMHistory[],
  ): Promise<void> {
    for await (const h of new_history) {
      await this.pushHistory(session, h);
    }
  }
}

export default InMemoryStore;
