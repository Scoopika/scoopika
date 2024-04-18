import new_error from "./lib/error";

class InMemoryStore {
  history: Record<string, LLMHistory[]> = {};
  sessions: StoreSession[] = [];

  constructor() {}

  checkSession(session: StoreSession): undefined {
    const sessions = this.sessions.filter(s => s.id === session.id);
    if (sessions.length < 1 || !this.history[session.id]) {
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
    this.sessions.push({ id, user_name });
    this.history[id] = [];
  }

  async getSession(id: string): Promise<StoreSession> {
    const wanted_sessions = this.sessions.filter(s => s.id === id);

    if (wanted_sessions.length < 1) {
      throw new Error(new_error(
        "session_not_found",
        `The session with ID ${id} is not found in session store.
        make sure to create a new session first`,
        "Get session"
      ))
    }

    return wanted_sessions[0];
  }

  async getHistory(session: StoreSession) {
    this.checkSession(session);

    const history = this.history[session.id];

    if (!history || history.length < 1) {
      return [];
    }

    const string_history = JSON.stringify(history);
    return JSON.parse(string_history) as LLMHistory[];
  }

  async pushHistory(session: StoreSession, new_history: LLMHistory) {
    this.history[session.id].push(new_history);
  }

  async batchPushHistory(session: StoreSession, new_history: LLMHistory[]) {
    for await (const h of new_history) {
      await this.pushHistory(session, h);
    }
  }

}

export default InMemoryStore;
