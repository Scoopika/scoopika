import new_error from "./lib/error";

class InMemoryStore {
  history: Record<string, Record<string, LLMHistory[]>> = {};
  sessions: StoreSession[] = [];

  constructor() {}

  check_session(session: StoreSession): undefined {
    if (this.sessions.indexOf(session) === -1 || !this.history[session.id]) {
      throw new Error(
        new_error(
          "session_notfound",
          `The session '${session.id}' does not exist`,
          "session check",
        ),
      );
    }
  }

  async getPromptHistory(
    session: StoreSession,
    prompt_name: string,
  ): Promise<LLMHistory[]> {
    this.check_session(session);
    const prompt_history: LLMHistory[] =
      this.history[session.id][prompt_name] || [];
    return prompt_history;
  }

  async addPromptHistory(
    session: StoreSession,
    prompt_name: string,
    prompt_history: LLMHistory,
  ): Promise<undefined> {
    this.check_session(session);

    if (!this.history[session.id][prompt_name]) {
      this.history[session.id][prompt_name] = [prompt_history];
      return;
    }

    this.history[session.id][prompt_name].push(prompt_history);
    return;
  }
}

export default InMemoryStore;
