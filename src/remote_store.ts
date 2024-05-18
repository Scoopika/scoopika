import { LLMHistory, RunHistory, Store, StoreSession } from "@scoopika/types";
import crypto from "node:crypto";

interface ErrorReqResponse {
  success: false;
  error: string;
}

interface SuccessReqResponse<Data> {
  success: true;
  data: Data;
}

type ReqResponse<Data> = ErrorReqResponse | SuccessReqResponse<Data>;

class RemoteStore implements Store {
  private url: string;
  private token: string;
  public history: Record<string, LLMHistory[]> = {};
  public sessions: Record<string, StoreSession> = {};
  public users_sessions: Record<string, string[]> = {};

  constructor(token: string, url: string) {
    this.token = token;
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }
    this.url = url;
  }

  async request<Response>(
    path: string,
    method: string,
    body?: Record<string, any>,
  ): Promise<Response> {
    const options: {
      method: string;
      headers: Record<string, string>;
      body?: string;
    } = {
      method,
      headers: {
        authorization: this.token,
      },
    };

    if (method !== "GET" && body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(`${this.url}/${path}`, options);
    const data = await res.json();

    return data as Response;
  }

  async newSession({
    id,
    user_id,
    user_name,
  }: {
    id?: string;
    user_id?: string;
    user_name?: string;
  }) {
    const res = await this.request<ReqResponse<unknown>>(
      `session/${id}`,
      "POST",
      {
        id: id ?? "session_" + crypto.randomUUID(),
        user_id,
        user_name,
      },
    );

    if (!res.success) {
      throw new Error(
        res.error || "Remote database error: Can't create session",
      );
    }
  }

  async getSession(id: string): Promise<StoreSession | undefined> {
    const res = await this.request<ReqResponse<StoreSession | undefined>>(
      `session/${id}`,
      "GET",
    );

    if (!res.success) {
      return undefined;
    }

    return res.data;
  }

  async deleteSession(id: string) {
    const res = await this.request<ReqResponse<unknown>>(
      `session/${id}`,
      "DELETE",
    );

    if (!res.success) {
      throw new Error(
        res.error || "Remote database error: Can't delete session",
      );
    }
  }

  async getUserSessions(user_id: string): Promise<string[]> {
    const res = await this.request<ReqResponse<string[]>>(
      `user_sessions/${user_id}`,
      "GET",
    );

    if (!res.success) {
      throw new Error(
        res.error || "Remote database error: can't get user sessions",
      );
    }

    return res.data;
  }

  async updateSession(
    id: string,
    new_data: {
      user_name?: string;
      saved_prompts?: Record<string, string>;
    },
  ) {
    const wanted_data: any = {};

    if (new_data.user_name) {
      wanted_data["user_name"] = new_data.user_name;
    }

    if (new_data.saved_prompts) {
      wanted_data["saved_prompts"] = new_data.saved_prompts;
    }

    const res = await this.request<ReqResponse<unknown>>(
      `session/${id}`,
      "PUT",
      wanted_data,
    );

    if (!res.success) {
      throw new Error(
        res.error || "Remote database error: Can't update session",
      );
    }
  }

  async getHistory(session: string | StoreSession): Promise<LLMHistory[]> {
    const id = typeof session === "string" ? session : session.id;
    const res = await this.request<ReqResponse<LLMHistory[]>>(
      `history/${id}`,
      "GET",
    );

    if (!res.success) {
      throw new Error(
        res.error || "Remote database error: Can't load session history",
      );
    }

    return res.data;
  }

  async pushHistory(
    session: string | StoreSession,
    new_history: LLMHistory | LLMHistory[],
  ): Promise<void> {
    const id = typeof session === "string" ? session : session.id;

    if (!Array.isArray(new_history)) {
      new_history = [new_history];
    }

    const res = await this.request<ReqResponse<unknown>>(
      `history/${id}`,
      "POST",
      {
        history: new_history,
      },
    );

    if (!res.success) {
      throw new Error(
        res.error || "Remote database error: Can't update history",
      );
    }
  }

  async batchPushHistory(
    session: string | StoreSession,
    new_history: LLMHistory[],
  ): Promise<void> {
    await this.pushHistory(session, new_history);
  }

  async getRuns(session: StoreSession | string): Promise<RunHistory[]> {
    const id = typeof session === "string" ? session : session.id;
    const res = await this.request<ReqResponse<RunHistory[]>>(
      `run/${id}`,
      "GET",
    );

    if (!res.success) {
      throw new Error(
        res.error || "Remote database error: Can't get session runs",
      );
    }

    return res.data;
  }

  async pushRun(session: StoreSession | string, run: RunHistory) {
    const id = typeof session === "string" ? session : session.id;

    const res = await this.request<ReqResponse<unknown>>(`run/${id}`, "POST", {
      history: [run],
    });

    if (!res.success) {
      throw new Error(res.error || "Remote database error: Can't push run");
    }
  }

  async batchPushRuns(session: StoreSession | string, runs: RunHistory[]) {
    const id = typeof session === "string" ? session : session.id;

    const res = await this.request<ReqResponse<unknown>>(`run/${id}`, "POST", {
      history: [...runs],
    });

    if (!res.success) {
      throw new Error(
        res.error || "Remote database error: Can't batch push runs",
      );
    }
  }
}

export default RemoteStore;
