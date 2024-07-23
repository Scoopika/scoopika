import { RunHistory, Store, StoreSession } from "@scoopika/types";
import { randomUUID } from "node:crypto";

export class InMemoryStore implements Store {
  public sessions: Record<string, StoreSession> = {};
  public users_sessions: Record<string, string[]> = {};
  public runs: Record<string, RunHistory[]> = {};

  async newSession({
    id,
    user_id,
  }: {
    id?: string;
    user_id?: string;
  }): Promise<StoreSession> {
    const session_id = id ?? "session_" + randomUUID();

    this.sessions[session_id] = {
      id: session_id,
      user_id,
    };

    if (!this.runs[session_id]) this.runs[session_id] = [];

    if (user_id && !this.users_sessions[user_id]) {
      this.users_sessions[user_id] = [session_id];
    } else if (user_id) {
      this.users_sessions[user_id].push(session_id);
    }

    const session = await this.getSession(session_id);
    if (!session) throw new Error("Could not create session!");

    return session;
  }

  async getSession(id: string): Promise<StoreSession | undefined> {
    const wanted_session = this.sessions[id];
    return wanted_session;
  }

  async deleteSession(id: string) {
    if (this.sessions[id]) {
      delete this.sessions[id];
    }
  }

  async getUserSessions(user_id: string): Promise<string[]> {
    return this.users_sessions[user_id] || [];
  }

  async pushRun(session: StoreSession | string, run: RunHistory) {
    const id = typeof session === "string" ? session : session.id;
    if (!this.runs[id]) {
      this.runs[id] = [];
    }

    this.runs[id].push(run);
  }

  async batchPushRuns(session: StoreSession | string, runs: RunHistory[]) {
    for (const r of runs) {
      await this.pushRun(session, r);
    }
  }

  async getRuns(session: StoreSession | string): Promise<RunHistory[]> {
    const id = typeof session === "string" ? session : session.id;
    return this.runs[id] ?? [];
  }

  async getMessages(session: StoreSession | string) {
    return await this.getRuns(session);
  }
}
