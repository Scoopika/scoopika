import { RunHistory, Store, StoreSession } from "@scoopika/types";
import { randomUUID } from "node:crypto";

interface ErrorReqResponse {
  success: false;
  error: string;
}

interface SuccessReqResponse<Data> {
  success: true;
  data: Data;
}

type ReqResponse<Data> = ErrorReqResponse | SuccessReqResponse<Data>;

export class RemoteStore implements Store {
  private url: string;
  private token: string;
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
    id = id ?? "session_" + randomUUID();
    const res = await this.request<ReqResponse<unknown>>(
      `session/${id}`,
      "POST",
      {
        id,
        user_id,
        user_name,
      },
    );

    if (res.success === false) {
      throw new Error(
        res.error || "Remote database error: Can't create session",
      );
    }

    return (await this.getSession(id)) as StoreSession;
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

    if (res.success === false) {
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

    if (res.success === false) {
      throw new Error(
        res.error || "Remote database error: can't get user sessions",
      );
    }

    return res.data;
  }

  async getRuns(session: StoreSession | string): Promise<RunHistory[]> {
    const id = typeof session === "string" ? session : session.id;
    const res = await this.request<ReqResponse<RunHistory[]>>(
      `run/${id}`,
      "GET",
    );

    if (res.success === false) {
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

    if (res.success === false) {
      throw new Error(res.error || "Remote database error: Can't push run");
    }
  }

  async batchPushRuns(session: StoreSession | string, runs: RunHistory[]) {
    const id = typeof session === "string" ? session : session.id;

    const res = await this.request<ReqResponse<unknown>>(`run/${id}`, "POST", {
      history: [...runs],
    });

    if (res.success === false) {
      throw new Error(
        res.error || "Remote database error: Can't batch push runs",
      );
    }
  }

  async getMessages(session: StoreSession | string): Promise<RunHistory[]> {
    return await this.getRuns(session);
  }
}
